const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const { z } = require("zod");
const {
  createPickupSchema,
  assignPickupSchema,
  updateStatusSchema,
} = require("../validation/schemas");
const {
  PICKUP_STATUSES,
  WASTE_TYPES,
  estimatedWasteKg,
} = require("../config/constants");
const { completePickupAndAwardPoints, getAvailablePoints } = require("../services/pointsService");
const { assignVehicleToPickup } = require("../services/assignmentService");
const { transitionPickupStatus } = require("../services/pickupStatusService");

const create = asyncHandler(async (req, res) => {
  const data = createPickupSchema.parse(req.body);
  const wasteQuantity = data.wasteQuantity || estimatedWasteKg(data.quantityBand);

  const pickup = await prisma.pickup.create({
    data: {
      userId: req.user.id,
      wasteType: data.wasteType,
      quantityBand: data.quantityBand,
      wasteQuantity,
      address: data.address,
      slotPeriod: data.slotPeriod,
      requestedDate: data.requestedDate,
      photoUrl: data.photoUrl || null,
      latitude: data.latitude !== undefined ? data.latitude : null,
      longitude: data.longitude !== undefined ? data.longitude : null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
    },
  });

  res.status(201).json({ pickup });
});

const list = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};

  if (req.user.role === "citizen") {
    where.userId = req.user.id;
  }
  if (status && status !== "all") {
    if (!PICKUP_STATUSES.includes(status)) {
      throw new HttpError(400, `Invalid status filter: ${status}`);
    }
    where.status = status;
  }

  const pickups = await prisma.pickup.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
      assignments: {
        where: { isActive: true },
        include: {
          vehicle: {
            include: {
              driver: { select: { id: true, name: true, phone: true, email: true } },
            },
          },
        },
      },
      pointsLedgerEntry: true,
    },
  });

  res.json({ pickups });
});

const getById = asyncHandler(async (req, res) => {
  const pickup = await prisma.pickup.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
      assignments: {
        where: { isActive: true },
        include: {
          vehicle: {
            include: {
              driver: { select: { id: true, name: true, phone: true, email: true } },
            },
          },
        },
      },
      pointsLedgerEntry: true,
    },
  });
  if (!pickup) throw new HttpError(404, "Pickup not found");

  if (req.user.role === "citizen" && pickup.userId !== req.user.id) {
    throw new HttpError(403, "Forbidden");
  }

  res.json({ pickup });
});

const assign = asyncHandler(async (req, res) => {
  const data = assignPickupSchema.parse(req.body);

  let vehicleId = data.vehicleId;

  // Support legacy payloads passing collectorId or adminId
  if (!vehicleId) {
    const targetUserId = data.collectorId || data.adminId;
    if (targetUserId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { driverId: targetUserId },
      });
      if (!vehicle) {
        throw new HttpError(
          400,
          "No active vehicle found for the specified collector. Please select a vehicle with an assigned driver."
        );
      }
      vehicleId = vehicle.id;
    }
  }

  if (!vehicleId) {
    throw new HttpError(400, "Vehicle ID or a collector with an assigned vehicle is required");
  }

  const { pickup, assignment } = await assignVehicleToPickup({
    pickupId: req.params.id,
    vehicleId,
    collectorId: data.collectorId || data.adminId,
    adminUserId: req.user.id,
    slotPeriod: data.slotPeriod,
    requestedDate: data.requestedDate,
  });

  res.json({ pickup, assignment });
});

const updateStatus = asyncHandler(async (req, res) => {
  const data = updateStatusSchema.parse(req.body);

  const { pickup, ledgerEntry, newBadges } = await transitionPickupStatus({
    pickupId: req.params.id,
    targetStatus: data.status,
    user: req.user,
    rejectionReason: data.rejectionReason,
    wasteQuantity: data.wasteQuantity,
  });

  res.json({
    pickup,
    ...(ledgerEntry ? { pointsEarned: ledgerEntry.pointsEarned } : {}),
    ...(newBadges ? { newBadges } : {}),
  });
});

const reject = asyncHandler(async (req, res) => {
  const rejectionReason =
    req.body?.rejectionReason ||
    req.body?.reason ||
    "Request does not meet recycling or collection guidelines.";

  const { pickup } = await transitionPickupStatus({
    pickupId: req.params.id,
    targetStatus: "rejected",
    user: req.user,
    rejectionReason,
  });

  res.json({ pickup, message: "Pickup request has been rejected." });
});

// Citizen personal environmental impact
const myImpact = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [
    allPickups,
    completedAgg,
    pointsAgg,
    availablePoints,
    userBadges,
    allBadges,
    redemptionsCount,
  ] = await Promise.all([
    prisma.pickup.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { pointsLedgerEntry: true },
    }),
    prisma.pickup.aggregate({
      where: { userId, status: "completed" },
      _sum: { wasteQuantity: true },
      _count: { _all: true },
    }),
    prisma.pointsLedger.aggregate({
      where: { userId },
      _sum: { pointsEarned: true },
    }),
    getAvailablePoints(prisma, userId),
    prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: "desc" },
    }),
    prisma.badge.findMany({ orderBy: { minPoints: "asc" } }),
    prisma.rewardRedemption.count({ where: { userId } }),
  ]);

  const totalWasteContributed = Number((completedAgg._sum.wasteQuantity || 0).toFixed(1));
  const completedPickupsCount = completedAgg._count._all;
  const totalPickupsCount = allPickups.length;
  const rejectedPickupsCount = allPickups.filter((p) => p.status === "rejected").length;
  const totalPointsEarned = pointsAgg._sum.pointsEarned || 0;

  // Waste category breakdown for this user
  const categoryMap = {};
  WASTE_TYPES.forEach((w) => {
    categoryMap[w.value] = { wasteType: w.value, label: w.label, weightKg: 0, count: 0 };
  });

  allPickups.forEach((p) => {
    if (p.status === "completed" && categoryMap[p.wasteType]) {
      categoryMap[p.wasteType].weightKg += p.wasteQuantity || estimatedWasteKg(p.quantityBand);
      categoryMap[p.wasteType].count += 1;
    }
  });

  const wasteCategoryBreakdown = Object.values(categoryMap).map((c) => ({
    ...c,
    weightKg: Number(c.weightKg.toFixed(1)),
  }));

  // Current and next badge
  const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));
  const currentBadge = userBadges[0]?.badge || null;
  const nextBadge = allBadges.find((b) => !earnedBadgeIds.has(b.id)) || null;

  // Monthly breakdown for last 6 months
  const now = new Date();
  const monthsData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthLabel = d.toLocaleString("default", { month: "short" });
    const fullMonthLabel = d.toLocaleString("default", { month: "short", year: "numeric" });

    const monthPickups = allPickups.filter((p) => {
      const pDate = new Date(p.createdAt);
      return pDate.getFullYear() === year && pDate.getMonth() === month;
    });

    const monthCompleted = monthPickups.filter((p) => p.status === "completed");
    const weightKg = monthCompleted.reduce(
      (sum, p) => sum + (p.wasteQuantity || estimatedWasteKg(p.quantityBand)),
      0
    );
    const points = monthCompleted.reduce(
      (sum, p) => sum + (p.pointsLedgerEntry?.pointsEarned || 0),
      0
    );

    monthsData.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      monthLabel,
      fullMonthLabel,
      weightKg: Number(weightKg.toFixed(1)),
      pickupsCount: monthPickups.length,
      completedCount: monthCompleted.length,
      pointsEarned: points,
    });
  }

  const thisMonthData = monthsData[monthsData.length - 1];

  res.json({
    totalWasteContributed,
    completedPickupsCount,
    totalPickupsCount,
    rejectedPickupsCount,
    totalPointsEarned,
    availablePoints,
    rewardsRedeemedCount: redemptionsCount,
    currentBadge,
    nextBadge,
    badges: userBadges.map((ub) => ({ ...ub.badge, earnedAt: ub.earnedAt })),
    wasteCategoryBreakdown,
    monthlyContribution: monthsData,
    thisMonth: thisMonthData,
    recentPickups: allPickups.slice(0, 5),
  });
});

const updateCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * PATCH /api/admin/pickups/:id/coordinates or PATCH /api/pickups/:id/coordinates
 * Admin endpoint to set/correct latitude and longitude for pickups missing coordinates.
 */
const updateCoordinates = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = updateCoordinatesSchema.parse(req.body);

  const pickup = await prisma.pickup.findUnique({ where: { id } });
  if (!pickup) throw new HttpError(404, "Pickup not found");

  const isAdmin = req.user.role === "admin";
  const isOwner = req.user.role === "citizen" && pickup.userId === req.user.id;

  if (!isAdmin && (!isOwner || pickup.status !== "requested")) {
    throw new HttpError(
      403,
      "Forbidden: Coordinates can only be modified by administrators, or by the citizen owner while the pickup is still in 'requested' status"
    );
  }

  const updated = await prisma.pickup.update({
    where: { id },
    data: { latitude, longitude },
  });

  res.json({ pickup: updated, message: "Pickup destination coordinates updated successfully" });
});

module.exports = { create, list, getById, assign, updateStatus, reject, myImpact, updateCoordinates };

