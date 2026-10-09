const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
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
  const assignedUserId = data.collectorId || data.adminId || req.user.id;

  const targetUser = await prisma.user.findUnique({ where: { id: assignedUserId } });
  if (!targetUser || (targetUser.role !== "admin" && targetUser.role !== "collector")) {
    throw new HttpError(400, "Assigned user must be an admin or collector");
  }

  const pickup = await prisma.pickup.findUnique({ where: { id: req.params.id } });
  if (!pickup) throw new HttpError(404, "Pickup not found");

  const result = await prisma.pickup.updateMany({
    where: { id: req.params.id, status: { notIn: ["completed", "cancelled"] } },
    data: {
      status: "assigned",
      assignedAdminId: assignedUserId,
      assignedAt: new Date(),
      ...(data.slotPeriod ? { slotPeriod: data.slotPeriod } : {}),
      ...(data.requestedDate ? { requestedDate: data.requestedDate } : {}),
    },
  });
  if (result.count === 0) {
    throw new HttpError(400, `Cannot assign a pickup that is already ${pickup.status}`);
  }

  const updated = await prisma.pickup.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
    },
  });

  res.json({ pickup: updated });
});

const updateStatus = asyncHandler(async (req, res) => {
  const data = updateStatusSchema.parse(req.body);

  const pickup = await prisma.pickup.findUnique({ where: { id: req.params.id } });
  if (!pickup) throw new HttpError(404, "Pickup not found");
  if (pickup.status === "completed" || pickup.status === "cancelled") {
    throw new HttpError(400, `Pickup is already ${pickup.status}`);
  }

  if (data.status === "rejected") {
    if (!data.rejectionReason || !data.rejectionReason.trim()) {
      throw new HttpError(400, "Rejection reason is required when rejecting a pickup");
    }
    const updated = await prisma.pickup.update({
      where: { id: req.params.id },
      data: {
        status: "rejected",
        rejectionReason: data.rejectionReason.trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
      },
    });
    return res.json({ pickup: updated });
  }

  if (data.status === "completed") {
    if (data.wasteQuantity) {
      await prisma.pickup.update({
        where: { id: req.params.id },
        data: { wasteQuantity: data.wasteQuantity },
      });
      pickup.wasteQuantity = data.wasteQuantity;
    }
    const result = await prisma.$transaction((tx) => completePickupAndAwardPoints(tx, pickup));
    const completedPickup = await prisma.pickup.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
      },
    });

    return res.json({
      pickup: completedPickup,
      pointsEarned: result.ledgerEntry.pointsEarned,
      newBadges: result.newBadges,
    });
  }

  const updated = await prisma.pickup.update({
    where: { id: req.params.id },
    data: { status: data.status },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
    },
  });
  res.json({ pickup: updated });
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

module.exports = { create, list, getById, assign, updateStatus, myImpact };
