const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const { z } = require("zod");

const createVehicleSchema = z.object({
  registrationNo: z.string().trim().min(2, "Registration number is required"),
  type: z.string().trim().min(2, "Vehicle type is required"),
  capacity: z.number().positive("Capacity must be greater than 0"),
  driverId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  currentLat: z.number().optional(),
  currentLng: z.number().optional(),
});

const updateVehicleSchema = z.object({
  registrationNo: z.string().trim().min(2).optional(),
  type: z.string().trim().min(2).optional(),
  capacity: z.number().positive().optional(),
  driverId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/vehicles/live
 * Returns all active vehicles with their latest coordinates and active pickups for the live fleet map.
 */
const getLiveFleet = asyncHandler(async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    include: {
      driver: {
        select: { id: true, name: true, phone: true, email: true },
      },
      assignments: {
        where: { isActive: true },
        include: {
          pickup: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
    },
    orderBy: { registrationNo: "asc" },
  });

  const liveFleet = vehicles.map((v) => {
    const ageSeconds = v.lastLocationAt
      ? Math.round((Date.now() - new Date(v.lastLocationAt).getTime()) / 1000)
      : null;

    return {
      id: v.id,
      registrationNo: v.registrationNo,
      type: v.type,
      capacity: v.capacity,
      driver: v.driver,
      location: {
        lat: v.currentLat,
        lng: v.currentLng,
        speed: v.currentSpeed || 0,
        heading: v.currentHeading || 0,
        lastLocationAt: v.lastLocationAt,
        isStale: ageSeconds !== null && ageSeconds > 30,
        ageSeconds,
      },
      activeAssignmentsCount: v.assignments.length,
      activePickups: v.assignments.map((a) => ({
        assignmentId: a.id,
        pickupId: a.pickup.id,
        status: a.pickup.status,
        address: a.pickup.address,
        latitude: a.pickup.latitude,
        longitude: a.pickup.longitude,
        citizenName: a.pickup.user.name,
        wasteType: a.pickup.wasteType,
        quantityBand: a.pickup.quantityBand,
        startedAt: a.startedAt,
        arrivedAt: a.arrivedAt,
      })),
    };
  });

  res.json({ vehicles: liveFleet });
});

/**
 * GET /api/admin/vehicles
 * Lists all vehicles with pagination / full list for vehicle management.
 */
const listVehicles = asyncHandler(async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      driver: {
        select: { id: true, name: true, email: true, phone: true, role: true },
      },
      assignments: {
        where: { isActive: true },
        select: { id: true, pickupId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ vehicles });
});

/**
 * POST /api/admin/vehicles
 * Creates a new fleet vehicle.
 */
const createVehicle = asyncHandler(async (req, res) => {
  const data = createVehicleSchema.parse(req.body);

  const existing = await prisma.vehicle.findUnique({
    where: { registrationNo: data.registrationNo.toUpperCase() },
  });
  if (existing) {
    throw new HttpError(400, `Vehicle with registration '${data.registrationNo}' already exists`);
  }

  if (data.driverId) {
    const driver = await prisma.user.findUnique({ where: { id: data.driverId } });
    if (!driver || driver.role !== "collector") {
      throw new HttpError(400, "Assigned driver must be a user with role 'collector'");
    }
    const alreadyAssigned = await prisma.vehicle.findUnique({
      where: { driverId: data.driverId },
    });
    if (alreadyAssigned) {
      throw new HttpError(400, `Driver is already assigned to vehicle ${alreadyAssigned.registrationNo}`);
    }
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      registrationNo: data.registrationNo.toUpperCase(),
      type: data.type,
      capacity: data.capacity,
      driverId: data.driverId || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      currentLat: data.currentLat || null,
      currentLng: data.currentLng || null,
      lastLocationAt: data.currentLat && data.currentLng ? new Date() : null,
    },
    include: {
      driver: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  res.status(201).json({ vehicle });
});

/**
 * PATCH /api/admin/vehicles/:id
 * Updates vehicle details or driver assignment.
 */
const updateVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = updateVehicleSchema.parse(req.body);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { assignments: { where: { isActive: true } } },
  });
  if (!vehicle) {
    throw new HttpError(404, "Vehicle not found");
  }

  // Block deactivating vehicle or changing driver if it has active assignments (409 Conflict)
  const hasActiveAssignments = vehicle.assignments.length > 0;
  if (hasActiveAssignments) {
    if (data.isActive === false && vehicle.isActive) {
      throw new HttpError(
        409,
        "Cannot deactivate vehicle with active assigned pickups. Reassign pickups first."
      );
    }
    if (data.driverId !== undefined && data.driverId !== vehicle.driverId) {
      throw new HttpError(
        409,
        "Cannot change vehicle driver while vehicle has active assigned pickups. Reassign pickups first."
      );
    }
  }

  if (data.driverId && data.driverId !== vehicle.driverId) {
    const driver = await prisma.user.findUnique({ where: { id: data.driverId } });
    if (!driver || driver.role !== "collector") {
      throw new HttpError(400, "Assigned driver must be a user with role 'collector'");
    }
    const alreadyAssigned = await prisma.vehicle.findUnique({
      where: { driverId: data.driverId },
    });
    if (alreadyAssigned && alreadyAssigned.id !== id) {
      throw new HttpError(400, `Driver is already assigned to vehicle ${alreadyAssigned.registrationNo}`);
    }
  }

  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(data.registrationNo ? { registrationNo: data.registrationNo.toUpperCase() } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.driverId !== undefined ? { driverId: data.driverId } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: {
      driver: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  res.json({ vehicle: updated });
});

/**
 * DELETE /api/admin/vehicles/:id
 * Soft deletes/deactivates a vehicle.
 */
const deleteVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { assignments: { where: { isActive: true } } },
  });
  if (!vehicle) throw new HttpError(404, "Vehicle not found");

  if (vehicle.assignments.length > 0) {
    throw new HttpError(409, "Cannot deactivate vehicle with active assigned pickups. Reassign pickups first.");
  }

  const deactivated = await prisma.vehicle.update({
    where: { id },
    data: { isActive: false, driverId: null },
  });

  res.json({ message: "Vehicle deactivated", vehicle: deactivated });
});

module.exports = {
  getLiveFleet,
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};
