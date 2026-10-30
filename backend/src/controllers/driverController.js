const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const { transitionPickupStatus } = require("../services/pickupStatusService");
const { z } = require("zod");

const updateDriverStatusSchema = z.object({
  status: z.enum(["on_the_way", "arrived", "completed"]),
  wasteQuantity: z.number().positive().optional(),
});

/**
 * GET /api/driver/pickups
 * Returns all active assigned pickups for the logged-in collector/driver.
 */
const getDriverPickups = asyncHandler(async (req, res) => {
  const driverId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: driverId },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  // Find vehicle assigned to driver
  const vehicle = await prisma.vehicle.findUnique({
    where: { driverId },
  });

  if (!vehicle) {
    return res.json({
      driver: user,
      vehicle: null,
      pickups: [],
      history: [],
    });
  }

  // Find all active assignments for this vehicle
  const activeAssignments = await prisma.pickupAssignment.findMany({
    where: {
      vehicleId: vehicle.id,
      isActive: true,
    },
    include: {
      pickup: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  // Fetch recent completed / past assignments for this vehicle
  const pastAssignments = await prisma.pickupAssignment.findMany({
    where: {
      vehicleId: vehicle.id,
      isActive: false,
    },
    include: {
      pickup: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
          pointsLedgerEntry: true,
        },
      },
    },
    orderBy: { assignedAt: "desc" },
    take: 20,
  });

  const pickups = activeAssignments.map((a) => ({
    ...a.pickup,
    assignment: {
      id: a.id,
      assignedAt: a.assignedAt,
      startedAt: a.startedAt,
      arrivedAt: a.arrivedAt,
    },
  }));

  const history = pastAssignments.map((a) => ({
    ...a.pickup,
    assignment: {
      id: a.id,
      assignedAt: a.assignedAt,
      startedAt: a.startedAt,
      arrivedAt: a.arrivedAt,
    },
  }));

  res.json({
    driver: user,
    vehicle: {
      id: vehicle.id,
      registrationNo: vehicle.registrationNo,
      type: vehicle.type,
      capacity: vehicle.capacity,
      currentLat: vehicle.currentLat,
      currentLng: vehicle.currentLng,
      isActive: vehicle.isActive,
    },
    pickups,
    history,
  });
});

/**
 * PATCH /api/driver/pickups/:id/status
 * Updates status of a pickup by the assigned driver (on_the_way, arrived, completed).
 */
const updatePickupStatusByDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = updateDriverStatusSchema.parse(req.body);

  const { pickup, ledgerEntry, newBadges } = await transitionPickupStatus({
    pickupId: id,
    targetStatus: data.status,
    user: req.user,
    wasteQuantity: data.wasteQuantity,
  });

  res.json({
    pickup,
    ...(ledgerEntry ? { pointsEarned: ledgerEntry.pointsEarned } : {}),
    ...(newBadges ? { newBadges } : {}),
  });
});

module.exports = {
  getDriverPickups,
  updatePickupStatusByDriver,
};
