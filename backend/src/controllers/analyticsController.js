const prisma = require("../db/client");
const { asyncHandler } = require("../middleware/errorHandler");
const { WASTE_TYPES, estimatedWasteKg } = require("../config/constants");

// Helper: build date filter from timeRange query param
function getDateFilter(timeRange, startDate, endDate) {
  if (startDate && endDate) {
    return {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  const now = new Date();
  if (timeRange === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { gte: start };
  }
  if (timeRange === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { gte: start };
  }
  if (timeRange === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: start };
  }
  if (timeRange === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { gte: start };
  }
  return null; // all time
}

// GET /api/admin/analytics/overview
const getOverview = asyncHandler(async (req, res) => {
  const { timeRange = "all", startDate, endDate } = req.query;
  const dateFilter = getDateFilter(timeRange, startDate, endDate);

  const pickupWhere = dateFilter ? { createdAt: dateFilter } : {};
  const completedPickupWhere = dateFilter
    ? { status: "completed", updatedAt: dateFilter }
    : { status: "completed" };
  const ledgerWhere = dateFilter ? { createdAt: dateFilter } : {};
  const redemptionWhere = dateFilter ? { redeemedAt: dateFilter } : {};

  const [
    statusCounts,
    wasteSum,
    totalPickups,
    totalCitizens,
    activeCitizensGroup,
    totalPointsIssued,
    totalRedemptions,
    recentPickups,
    recentUsers,
  ] = await Promise.all([
    // Pickups grouped by status
    prisma.pickup.groupBy({
      by: ["status"],
      where: pickupWhere,
      _count: { _all: true },
    }),
    // Sum of waste quantity for completed pickups
    prisma.pickup.aggregate({
      where: completedPickupWhere,
      _sum: { wasteQuantity: true },
    }),
    // Total pickups count
    prisma.pickup.count({ where: pickupWhere }),
    // Total registered citizens
    prisma.user.count({ where: { role: "citizen" } }),
    // Active users: citizens who requested at least 1 pickup in this timeframe
    prisma.pickup.groupBy({
      by: ["userId"],
      where: pickupWhere,
    }),
    // Green points distributed
    prisma.pointsLedger.aggregate({
      where: ledgerWhere,
      _sum: { pointsEarned: true },
    }),
    // Rewards redeemed
    prisma.rewardRedemption.count({ where: redemptionWhere }),
    // Recent 5 pickups for overview dashboard
    prisma.pickup.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true, role: true } },
      },
    }),
    // Recent 5 users
    prisma.user.findMany({
      where: { role: "citizen" },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    }),
  ]);

  const countByStatus = {};
  statusCounts.forEach((s) => {
    countByStatus[s.status] = s._count._all;
  });

  const completedPickups = countByStatus.completed || 0;
  const pendingPickups = countByStatus.requested || 0;
  const assignedPickups = countByStatus.assigned || 0;
  const rejectedPickups = countByStatus.rejected || 0;
  const cancelledPickups = countByStatus.cancelled || 0;
  const totalWasteCollected = Number((wasteSum._sum.wasteQuantity || 0).toFixed(1));
  const activeUsersCount = activeCitizensGroup.length;
  const pointsDistributed = totalPointsIssued._sum.pointsEarned || 0;

  res.json({
    timeRange,
    totalWasteCollected,
    totalPickups,
    completedPickups,
    pendingPickups,
    assignedPickups,
    rejectedPickups,
    cancelledPickups,
    totalRegisteredUsers: totalCitizens,
    activeUsers: activeUsersCount,
    totalPointsDistributed: pointsDistributed,
    totalRewardsRedeemed: totalRedemptions,
    statusBreakdown: [
      { status: "requested", label: "Pending", count: pendingPickups, fill: "#d97706" },
      { status: "assigned", label: "Assigned", count: assignedPickups, fill: "#2563eb" },
      { status: "completed", label: "Completed", count: completedPickups, fill: "#16a34a" },
      { status: "rejected", label: "Rejected", count: rejectedPickups, fill: "#dc2626" },
      { status: "cancelled", label: "Cancelled", count: cancelledPickups, fill: "#6b7280" },
    ],
    recentPickups,
    recentUsers,
  });
});

// GET /api/admin/analytics/monthly?year=2026&month=10
const getMonthly = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year || now.getFullYear(), 10);
  const month = parseInt(req.query.month || now.getMonth() + 1, 10); // 1-indexed (1 to 12)

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1); // start of next month

  const [
    monthPickups,
    wasteSum,
    monthPoints,
    activeUsersGroup,
  ] = await Promise.all([
    prisma.pickup.findMany({
      where: {
        createdAt: { gte: startDate, lt: endDate },
      },
      select: { id: true, status: true, wasteQuantity: true, userId: true },
    }),
    prisma.pickup.aggregate({
      where: {
        status: "completed",
        updatedAt: { gte: startDate, lt: endDate },
      },
      _sum: { wasteQuantity: true },
    }),
    prisma.pointsLedger.aggregate({
      where: {
        createdAt: { gte: startDate, lt: endDate },
      },
      _sum: { pointsEarned: true },
    }),
    prisma.pickup.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: startDate, lt: endDate },
      },
    }),
  ]);

  const totalPickups = monthPickups.length;
  const completedPickups = monthPickups.filter((p) => p.status === "completed").length;
  const rejectedPickups = monthPickups.filter((p) => p.status === "rejected").length;
  const pendingPickups = monthPickups.filter((p) => p.status === "requested").length;
  const assignedPickups = monthPickups.filter((p) => p.status === "assigned").length;
  const cancelledPickups = monthPickups.filter((p) => p.status === "cancelled").length;
  const totalWasteCollected = Number((wasteSum._sum.wasteQuantity || 0).toFixed(1));
  const totalPointsGenerated = monthPoints._sum.pointsEarned || 0;
  const activeUsers = activeUsersGroup.length;

  const monthName = startDate.toLocaleString("default", { month: "long", year: "numeric" });

  res.json({
    year,
    month,
    monthName,
    totalWasteCollected,
    totalPickups,
    completedPickups,
    rejectedPickups,
    pendingPickups,
    assignedPickups,
    cancelledPickups,
    totalPointsGenerated,
    activeUsers,
  });
});

// GET /api/admin/analytics/trends
const getTrends = asyncHandler(async (req, res) => {
  const monthsCount = parseInt(req.query.months || "6", 10);
  const now = new Date();

  // Pull all pickups and ledger entries for the window
  const startWindow = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1), 1);

  const [allPickups, allLedger] = await Promise.all([
    prisma.pickup.findMany({
      where: { createdAt: { gte: startWindow } },
      select: {
        id: true,
        status: true,
        wasteQuantity: true,
        wasteType: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.pointsLedger.findMany({
      where: { createdAt: { gte: startWindow } },
      select: { pointsEarned: true, createdAt: true },
    }),
  ]);

  const monthTrends = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const key = `${yr}-${String(mo + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleString("default", { month: "short" });
    const fullLabel = d.toLocaleString("default", { month: "short", year: "numeric" });

    const mPickups = allPickups.filter((p) => {
      const pDate = new Date(p.createdAt);
      return pDate.getFullYear() === yr && pDate.getMonth() === mo;
    });

    const mCompleted = mPickups.filter((p) => p.status === "completed");
    const mRejected = mPickups.filter((p) => p.status === "rejected");
    const wasteKg = mCompleted.reduce((sum, p) => sum + (p.wasteQuantity || 0), 0);

    const uniqueUsers = new Set(mPickups.map((p) => p.userId)).size;

    const mLedger = allLedger.filter((l) => {
      const lDate = new Date(l.createdAt);
      return lDate.getFullYear() === yr && lDate.getMonth() === mo;
    });
    const points = mLedger.reduce((sum, l) => sum + l.pointsEarned, 0);

    monthTrends.push({
      key,
      monthLabel,
      fullLabel,
      totalPickups: mPickups.length,
      completedPickups: mCompleted.length,
      rejectedPickups: mRejected.length,
      wasteCollectedKg: Number(wasteKg.toFixed(1)),
      activeUsers: uniqueUsers,
      pointsDistributed: points,
    });
  }

  // Also pickup status distribution (all-time)
  const statusGroups = await prisma.pickup.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const statusDistribution = statusGroups.map((s) => ({
    status: s.status,
    count: s._count._all,
  }));

  res.json({
    monthTrends,
    statusDistribution,
  });
});

// GET /api/admin/analytics/waste-category
const getWasteCategories = asyncHandler(async (req, res) => {
  const completedPickups = await prisma.pickup.findMany({
    where: { status: "completed" },
    select: { wasteType: true, wasteQuantity: true, quantityBand: true },
  });

  const categoryMap = {};
  WASTE_TYPES.forEach((w) => {
    categoryMap[w.value] = {
      wasteType: w.value,
      label: w.label,
      totalKg: 0,
      pickupCount: 0,
    };
  });

  let grandTotalKg = 0;
  completedPickups.forEach((p) => {
    const kg = p.wasteQuantity || estimatedWasteKg(p.quantityBand);
    grandTotalKg += kg;
    if (categoryMap[p.wasteType]) {
      categoryMap[p.wasteType].totalKg += kg;
      categoryMap[p.wasteType].pickupCount += 1;
    }
  });

  const categories = Object.values(categoryMap).map((c) => ({
    ...c,
    totalKg: Number(c.totalKg.toFixed(1)),
    percentage: grandTotalKg > 0 ? Number(((c.totalKg / grandTotalKg) * 100).toFixed(1)) : 0,
  }));

  res.json({
    totalCompletedPickups: completedPickups.length,
    grandTotalKg: Number(grandTotalKg.toFixed(1)),
    categories,
  });
});

module.exports = {
  getOverview,
  getMonthly,
  getTrends,
  getWasteCategories,
};
