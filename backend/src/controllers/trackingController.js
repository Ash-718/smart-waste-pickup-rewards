const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const { getRouteAndEta } = require("../services/routingService");

/**
 * GET /api/pickups/:id/tracking
 * Returns full tracking payload: latest vehicle telemetry, driver card,
 * pickup address & coordinates, OSRM route geometry & ETA, and trip status timestamps.
 */
const getPickupTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pickup = await prisma.pickup.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      pointsLedgerEntry: true,
      assignments: {
        orderBy: { assignedAt: "desc" },
        take: 1,
        include: {
          vehicle: {
            include: {
              driver: {
                select: { id: true, name: true, phone: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!pickup) {
    throw new HttpError(404, "Pickup not found");
  }

  // Authorization check: Citizen must own pickup, Collector must be assigned, or Admin
  const isOwner = req.user.role === "citizen" && pickup.userId === req.user.id;
  const isAdmin = req.user.role === "admin";
  const activeAssignment = pickup.assignments[0];
  const isAssignedDriver =
    req.user.role === "collector" &&
    ((activeAssignment && activeAssignment.vehicle.driverId === req.user.id) ||
      pickup.assignedAdminId === req.user.id);

  if (!isOwner && !isAdmin && !isAssignedDriver) {
    throw new HttpError(403, "Forbidden: You do not have permission to view tracking for this pickup");
  }

  const vehicle = activeAssignment ? activeAssignment.vehicle : null;
  const driver = vehicle ? vehicle.driver : null;

  // Server-authoritative stale location detection (>30 seconds)
  const nowServerMs = Date.now();
  let isStale = false;
  let ageSeconds = null;
  if (vehicle && vehicle.lastLocationAt) {
    ageSeconds = Math.max(0, Math.round((nowServerMs - new Date(vehicle.lastLocationAt).getTime()) / 1000));
    isStale = ageSeconds > 30;
  }

  // Pickup destination coordinates
  const destinationCoords =
    pickup.latitude && pickup.longitude
      ? { lat: pickup.latitude, lng: pickup.longitude }
      : null;

  // Vehicle origin coordinates
  const originCoords =
    vehicle && vehicle.currentLat && vehicle.currentLng
      ? { lat: vehicle.currentLat, lng: vehicle.currentLng }
      : null;

  // Compute live route geometry and ETA via OSRM (with cache & Haversine fallback)
  let routeAndEta = null;
  if (originCoords && destinationCoords && ["assigned", "on_the_way", "arrived"].includes(pickup.status)) {
    routeAndEta = await getRouteAndEta(originCoords, destinationCoords);
  }

  res.json({
    serverTime: new Date(nowServerMs).toISOString(),
    ageSeconds,
    tracking: {
      pickupId: pickup.id,
      status: pickup.status,
      wasteType: pickup.wasteType,
      quantityBand: pickup.quantityBand,
      wasteQuantity: pickup.wasteQuantity,
      address: pickup.address,
      pickupCoordinates: destinationCoords,
      assignedAt: activeAssignment?.assignedAt || pickup.assignedAt,
      startedAt: activeAssignment?.startedAt || null,
      arrivedAt: activeAssignment?.arrivedAt || null,
      completedAt: activeAssignment?.completedAt || null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            registrationNo: vehicle.registrationNo,
            type: vehicle.type,
            capacity: vehicle.capacity,
            location: {
              lat: vehicle.currentLat,
              lng: vehicle.currentLng,
              speed: vehicle.currentSpeed,
              heading: vehicle.currentHeading,
              recordedAt: vehicle.lastLocationAt,
              ageSeconds,
              isStale,
            },
          }
        : null,
      driver: driver
        ? {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
          }
        : null,
      navigation: routeAndEta || null,
      pointsEarned: pickup.pointsLedgerEntry?.pointsEarned || null,
    },
  });
});

module.exports = { getPickupTracking };
