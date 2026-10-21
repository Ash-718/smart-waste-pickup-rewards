const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("../db/client");

let ioInstance = null;

// Rate limiting & history throttling caches
const lastUpdateByVehicle = new Map(); // 3s rate-limit
const lastHistoryByVehicle = new Map(); // 15s history persistence throttle

/**
 * Initializes Socket.IO server with JWT authentication and real-time room handlers.
 * 
 * @param {import("http").Server} httpServer
 * @returns {Server}
 */
function initSocketServer(httpServer) {
  const rawOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  const corsConfig =
    rawOrigins.length > 0
      ? { origin: rawOrigins, methods: ["GET", "POST", "PATCH", "PUT", "DELETE"], credentials: true }
      : { origin: "*", methods: ["GET", "POST", "PATCH", "PUT", "DELETE"] };

  const io = new Server(httpServer, {
    cors: corsConfig,
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  ioInstance = io;

  // 1. Handshake JWT Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const header = socket.handshake.headers.authorization || "";
      const queryToken = socket.handshake.auth?.token;
      const rawToken = queryToken || (header.startsWith("Bearer ") ? header.slice(7) : null);

      if (!rawToken) {
        return next(new Error("Authentication error: Token missing"));
      }

      const payload = jwt.verify(rawToken, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, role: true, email: true },
      });

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  // 2. Connection and Room Management
  io.on("connection", (socket) => {
    const user = socket.user;

    // --- Join Pickup Room with strict authorization ---
    socket.on("join:pickup", async ({ pickupId }, callback) => {
      try {
        if (!pickupId) {
          const err = "Pickup ID is required";
          if (callback) callback({ error: err });
          return socket.emit("join:error", { error: err });
        }

        const pickup = await prisma.pickup.findUnique({
          where: { id: pickupId },
          include: {
            assignments: {
              where: { isActive: true },
              include: { vehicle: true },
            },
          },
        });

        if (!pickup) {
          const err = "Pickup not found";
          if (callback) callback({ error: err });
          return socket.emit("join:error", { error: err });
        }

        // Authorization check:
        // - Admin: allowed
        // - Citizen: must be the creator of the pickup
        // - Collector: must be assigned driver on an active assignment or assignedAdminId
        const isAdmin = user.role === "admin";
        const isCitizenOwner = user.role === "citizen" && pickup.userId === user.id;
        const activeAssignment = pickup.assignments[0];
        const isAssignedCollector =
          user.role === "collector" &&
          ((activeAssignment && activeAssignment.vehicle.driverId === user.id) ||
            pickup.assignedAdminId === user.id);

        if (!isAdmin && !isCitizenOwner && !isAssignedCollector) {
          const err = "Forbidden: You do not have permission to track this pickup";
          if (callback) callback({ error: err });
          return socket.emit("join:error", { error: err });
        }

        const roomName = `pickup:${pickupId}`;
        socket.join(roomName);

        const successPayload = { room: roomName, pickupId, status: pickup.status };
        if (callback) callback(successPayload);
        socket.emit("join:success", successPayload);
      } catch (err) {
        console.error("[Socket] Error joining pickup room:", err);
        if (callback) callback({ error: "Failed to join room" });
      }
    });

    // --- Leave Pickup Room ---
    socket.on("leave:pickup", ({ pickupId }) => {
      if (pickupId) {
        socket.leave(`pickup:${pickupId}`);
      }
    });

    // --- Join Live Fleet Room (Admin only) ---
    socket.on("join:fleet", (data, callback) => {
      if (user.role !== "admin") {
        const err = "Forbidden: Only administrators can subscribe to live fleet";
        if (callback) callback({ error: err });
        return socket.emit("join:error", { error: err });
      }
      socket.join("fleet:live");
      if (callback) callback({ room: "fleet:live", success: true });
    });

    // --- Driver Location Updates ---
    socket.on("driver:location", async (payload, callback) => {
      try {
        // Rule: Only users with role 'collector' may emit driver location
        if (user.role !== "collector") {
          return;
        }

        const { lat, lng, speed = 0, heading = 0 } = payload || {};

        // Validate lat/lng ranges
        if (
          typeof lat !== "number" ||
          typeof lng !== "number" ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180 ||
          speed < 0 ||
          heading < 0 ||
          heading > 360
        ) {
          if (callback) callback({ error: "Invalid location coordinates or telemetry values" });
          return;
        }

        // Rule: "Only the collector whose vehicle has an active assignment may emit driver:location. Ignore all others."
        const vehicle = await prisma.vehicle.findUnique({
          where: { driverId: user.id },
          include: {
            assignments: {
              where: { isActive: true },
              select: { pickupId: true },
            },
          },
        });

        if (!vehicle || !vehicle.isActive || vehicle.assignments.length === 0) {
          if (callback) callback({ error: "No active assignments for this driver" });
          return; // Ignore
        }

        // Rate limiting: 1 update per 3 seconds per vehicle
        const now = Date.now();
        const lastUpdate = lastUpdateByVehicle.get(vehicle.id) || 0;
        if (now - lastUpdate < 3000) {
          if (callback) callback({ rateLimited: true });
          return; // Throttled
        }
        lastUpdateByVehicle.set(vehicle.id, now);

        const recordedAt = new Date();

        // 1. Fast lookup: update Vehicle current location columns
        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: {
            currentLat: lat,
            currentLng: lng,
            currentSpeed: speed,
            currentHeading: heading,
            lastLocationAt: recordedAt,
          },
        });

        // 2. Telemetry history persistence (throttled to ~15s)
        const lastHistory = lastHistoryByVehicle.get(vehicle.id) || 0;
        if (now - lastHistory >= 15000) {
          lastHistoryByVehicle.set(vehicle.id, now);
          // Persist asynchronously without blocking broadcast
          prisma.vehicleLocation
            .create({
              data: {
                vehicleId: vehicle.id,
                lat,
                lng,
                speed,
                heading,
                recordedAt,
              },
            })
            .catch((err) => console.error("[Socket] Error saving location history:", err));
        }

        const locationBroadcast = {
          vehicleId: vehicle.id,
          registrationNo: vehicle.registrationNo,
          driverId: user.id,
          driverName: user.name,
          lat,
          lng,
          speed,
          heading,
          recordedAt: recordedAt.toISOString(),
        };

        // Broadcast to EVERY active assignment's room for that vehicle
        for (const assignment of vehicle.assignments) {
          io.to(`pickup:${assignment.pickupId}`).emit("vehicle:location", {
            pickupId: assignment.pickupId,
            ...locationBroadcast,
          });
        }

        // Broadcast to admin live fleet map (dedicated fleet telemetry event)
        io.to("fleet:live").emit("fleet:vehicle_location", locationBroadcast);

        if (callback) callback({ success: true, timestamp: recordedAt });
      } catch (err) {
        console.error("[Socket] Error handling driver:location:", err);
        if (callback) callback({ error: "Internal socket error" });
      }
    });

    socket.on("disconnect", () => {
      // Clean up socket resources automatically handled by Socket.IO
    });
  });

  return io;
}

/**
 * Returns the active Socket.IO server instance.
 */
function getIO() {
  return ioInstance;
}

/**
 * Broadcasts status changes to all subscribers of the pickup room and live fleet.
 */
function broadcastPickupStatus(pickupId, status, extra = {}) {
  if (!ioInstance) return;

  const payload = {
    pickupId,
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  ioInstance.to(`pickup:${pickupId}`).emit("pickup:status", payload);
  ioInstance.to("fleet:live").emit("fleet:pickup_status", payload);
}

module.exports = {
  initSocketServer,
  getIO,
  broadcastPickupStatus,
};
