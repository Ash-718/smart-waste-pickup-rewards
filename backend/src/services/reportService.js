const prisma = require("../db/client");
const { WASTE_TYPES, QUANTITY_BANDS, estimatedWasteKg } = require("../config/constants");
const { getAvailablePoints } = require("./pointsService");

/**
 * Builds and validates date filters.
 */
function parseDateRange({ period = "30d", startDate, endDate } = {}) {
  const now = new Date();
  let gte = null;
  let lte = new Date(now);
  let periodLabel = "Last 30 Days";

  if (period === "custom" && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid custom date format. Use YYYY-MM-DD.");
    }
    if (start > end) {
      throw new Error("Start date must be before or equal to end date.");
    }
    // Set start to beginning of day, end to end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    gte = start;
    lte = end;
    periodLabel = `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`;
  } else if (period === "7d") {
    gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    periodLabel = "Last 7 Days";
  } else if (period === "30d") {
    gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    periodLabel = "Last 30 Days";
  } else if (period === "90d" || period === "3m") {
    gte = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    periodLabel = "Last 3 Months";
  } else if (period === "180d" || period === "6m") {
    gte = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    periodLabel = "Last 6 Months";
  } else if (period === "all") {
    gte = null;
    lte = null;
    periodLabel = "All Time";
  } else {
    // Default to last 30 days
    gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    periodLabel = "Last 30 Days";
  }

  const dateFilter = gte ? { gte, lte } : null;
  return { dateFilter, periodLabel, gte, lte };
}

/**
 * Returns formatted label for waste category code.
 */
function getWasteCategoryLabel(category) {
  const match = WASTE_TYPES.find((w) => w.value === category);
  return match ? match.label : category || "Unclassified";
}

/**
 * Gathers complete personal impact and pickup data for an authenticated citizen.
 */
async function getCitizenReportData(userId, queryOptions = {}) {
  const { dateFilter, periodLabel, gte, lte } = parseDateRange(queryOptions);

  // 1. Fetch Citizen Profile & Available Points
  const [citizen, currentPointsBalance] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    }),
    getAvailablePoints(prisma, userId),
  ]);

  if (!citizen) {
    throw new Error("Citizen user record not found.");
  }

  // 2. Fetch Pickups for this citizen in the date window
  const pickupWhere = {
    userId,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const pickups = await prisma.pickup.findMany({
    where: pickupWhere,
    orderBy: { createdAt: "desc" },
    include: {
      pointsLedgerEntry: true,
      assignments: {
        where: { isActive: true },
        include: {
          vehicle: {
            select: { registrationNo: true, type: true },
          },
        },
      },
    },
  });

  // Also query all-time completed pickups to compute overall citizen stats
  const allTimeCompletedCount = await prisma.pickup.count({
    where: { userId, status: "completed" },
  });

  // 3. Pickup Statistics
  const totalPickups = pickups.length;
  let completedCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  let rejectedCount = 0;
  let totalVerifiedWasteKg = 0;

  // Category breakdown
  const categoryMap = {};
  WASTE_TYPES.forEach((w) => {
    categoryMap[w.value] = {
      category: w.value,
      label: w.label,
      count: 0,
      verifiedKg: 0,
    };
  });

  const pickupHistory = pickups.map((p) => {
    const isCompleted = p.status === "completed";
    const isPending = ["requested", "assigned", "on_the_way", "arrived"].includes(p.status);
    const isCancelled = p.status === "cancelled";
    const isRejected = p.status === "rejected";

    if (isCompleted) completedCount++;
    if (isPending) pendingCount++;
    if (isCancelled) cancelledCount++;
    if (isRejected) rejectedCount++;

    const kg = isCompleted && typeof p.wasteQuantity === "number" ? p.wasteQuantity : 0;
    if (isCompleted) {
      totalVerifiedWasteKg += kg;
      if (categoryMap[p.wasteType]) {
        categoryMap[p.wasteType].verifiedKg += kg;
      }
    }

    if (categoryMap[p.wasteType]) {
      categoryMap[p.wasteType].count += 1;
    }

    const assignedVehicle = p.assignments?.[0]?.vehicle?.registrationNo || null;
    const pointsEarned = p.pointsLedgerEntry?.pointsEarned || 0;

    return {
      id: p.id,
      date: p.createdAt.toISOString().slice(0, 10),
      createdAt: p.createdAt,
      category: p.wasteType,
      categoryLabel: getWasteCategoryLabel(p.wasteType),
      quantityBand: p.quantityBand,
      wasteQuantityKg: p.wasteQuantity !== null ? Number(p.wasteQuantity.toFixed(1)) : null,
      status: p.status,
      address: p.address,
      assignedVehicle,
      pointsEarned,
      rejectionReason: p.rejectionReason,
    };
  });

  const completionRate = totalPickups > 0 ? Number(((completedCount / totalPickups) * 100).toFixed(1)) : 0;
  totalVerifiedWasteKg = Number(totalVerifiedWasteKg.toFixed(1));

  const wasteByCategory = Object.values(categoryMap).map((c) => ({
    category: c.category,
    label: c.label,
    count: c.count,
    verifiedKg: Number(c.verifiedKg.toFixed(1)),
    percentage:
      totalVerifiedWasteKg > 0 ? Number(((c.verifiedKg / totalVerifiedWasteKg) * 100).toFixed(1)) : 0,
  }));

  // 4. Points & Rewards Ledger
  const ledgerWhere = {
    userId,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  const pointsLedgerEntries = await prisma.pointsLedger.findMany({
    where: ledgerWhere,
    orderBy: { createdAt: "desc" },
    include: {
      pickup: {
        select: { id: true, wasteType: true, quantityBand: true, createdAt: true },
      },
    },
  });

  const pointsEarnedInPeriod = pointsLedgerEntries.reduce((sum, e) => sum + e.pointsEarned, 0);

  // All-time points earned
  const allTimePointsAgg = await prisma.pointsLedger.aggregate({
    where: { userId },
    _sum: { pointsEarned: true },
  });
  const totalAllTimePointsEarned = allTimePointsAgg._sum.pointsEarned || 0;

  // Rewards redeemed in date range
  const redemptionsWhere = {
    userId,
    ...(dateFilter ? { redeemedAt: dateFilter } : {}),
  };

  const redemptions = await prisma.rewardRedemption.findMany({
    where: redemptionsWhere,
    orderBy: { redeemedAt: "desc" },
    include: {
      reward: {
        select: { name: true, pointsRequired: true },
      },
    },
  });

  const pointsRedeemedInPeriod = redemptions.reduce((sum, r) => sum + r.pointsSpent, 0);

  // User Badges unlocked
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    include: {
      badge: true,
    },
  });

  const badgesUnlocked = userBadges.map((ub) => ({
    name: ub.badge.name,
    description: ub.badge.description,
    minPoints: ub.badge.minPoints,
    earnedAt: ub.earnedAt.toISOString().slice(0, 10),
  }));

  const rewardsRedeemedHistory = redemptions.map((r) => ({
    id: r.id,
    rewardName: r.reward.name,
    pointsSpent: r.pointsSpent,
    redemptionCode: r.redemptionCode,
    redeemedAt: r.redeemedAt.toISOString().slice(0, 10),
  }));

  // 5. Environmental Impact (Verified calculations)
  // 100% of verified collected recyclable waste is diverted from municipal dumpsites.
  const environmentalImpact = {
    landfillDiversionKg: totalVerifiedWasteKg,
    recyclablesProcessedCount: completedCount,
    activeRecyclingDays: new Set(pickups.filter((p) => p.status === "completed").map((p) => p.createdAt.toISOString().slice(0, 10))).size,
    streamsDiverted: wasteByCategory.filter((w) => w.verifiedKg > 0).map((w) => ({
      stream: w.label,
      weightKg: w.verifiedKg,
    })),
    civicIndex: {
      totalCompletedAllTime: allTimeCompletedCount,
      reliableRecyclerRating: completionRate >= 80 ? "Grade A - Exemplary" : completionRate >= 50 ? "Grade B - Active" : "Grade C - Developing",
    },
  };

  return {
    citizen: {
      id: citizen.id,
      name: citizen.name,
      email: citizen.email,
      phone: citizen.phone,
      memberSince: citizen.createdAt.toISOString().slice(0, 10),
      currentPointsBalance,
    },
    reportingPeriod: {
      period: queryOptions.period || "30d",
      label: periodLabel,
      startDate: gte ? gte.toISOString().slice(0, 10) : "Inception",
      endDate: lte ? lte.toISOString().slice(0, 10) : "Present",
      generatedAt: new Date().toISOString(),
    },
    pickupStatistics: {
      totalPickups,
      completedPickups: completedCount,
      pendingPickups: pendingCount,
      cancelledPickups: cancelledCount,
      rejectedPickups: rejectedCount,
      completionRate,
      totalVerifiedWasteKg,
      wasteByCategory,
      pickupHistory,
    },
    greenPointsAndRewards: {
      pointsEarnedInPeriod,
      totalAllTimePointsEarned,
      currentPointsBalance,
      pointsRedeemedInPeriod,
      badgesUnlocked,
      rewardsRedeemedCount: redemptions.length,
      rewardsRedeemedHistory,
      pointsLedgerTransactions: pointsLedgerEntries.map((e) => ({
        id: e.id,
        date: e.createdAt.toISOString().slice(0, 10),
        pickupId: e.pickupId,
        pointsEarned: e.pointsEarned,
        category: getWasteCategoryLabel(e.pickup?.wasteType),
      })),
    },
    environmentalImpact,
  };
}

/**
 * Gathers platform-wide analytics report data for administrators.
 */
async function getAdminReportData(queryOptions = {}) {
  const { dateFilter, periodLabel, gte, lte } = parseDateRange(queryOptions);
  const { category } = queryOptions;

  const pickupWhere = {
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(category && category !== "all" ? { wasteType: category } : {}),
  };

  const completedWhere = {
    status: "completed",
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(category && category !== "all" ? { wasteType: category } : {}),
  };

  // 1. Parallel Aggregations
  const [
    pickups,
    totalRegisteredCitizens,
    activeCitizensGroup,
    allVehicles,
    activeAssignments,
    pointsAgg,
    redemptionsAgg,
    allRewards,
    badgeCounts,
  ] = await Promise.all([
    // Pickups with vehicle and collector info
    prisma.pickup.findMany({
      where: pickupWhere,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignments: {
          include: {
            vehicle: {
              include: {
                driver: { select: { id: true, name: true, email: true, phone: true } },
              },
            },
          },
        },
      },
    }),
    // Registered citizens
    prisma.user.count({ where: { role: "citizen" } }),
    // Active citizens in period
    prisma.pickup.groupBy({
      by: ["userId"],
      where: pickupWhere,
    }),
    // All registered vehicles
    prisma.vehicle.findMany({
      include: {
        driver: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { registrationNo: "asc" },
    }),
    // Active assignments
    prisma.pickupAssignment.count({ where: { isActive: true } }),
    // Green points distributed in period
    prisma.pointsLedger.aggregate({
      where: dateFilter ? { createdAt: dateFilter } : {},
      _sum: { pointsEarned: true },
    }),
    // Redemptions aggregate
    prisma.rewardRedemption.aggregate({
      where: dateFilter ? { redeemedAt: dateFilter } : {},
      _sum: { pointsSpent: true },
      _count: { _all: true },
    }),
    // Rewards catalogue
    prisma.reward.findMany({
      include: {
        _count: { select: { redemptions: true } },
      },
      orderBy: { name: "asc" },
    }),
    // Badges earned count
    prisma.userBadge.groupBy({
      by: ["badgeId"],
      _count: { _all: true },
    }),
  ]);

  // A. Pickup Analytics
  const totalPickups = pickups.length;
  let completedCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  let rejectedCount = 0;
  let totalVerifiedWasteKg = 0;

  const categoryMap = {};
  WASTE_TYPES.forEach((w) => {
    categoryMap[w.value] = {
      category: w.value,
      label: w.label,
      count: 0,
      verifiedKg: 0,
    };
  });

  // Collector performance map
  const collectorMap = {};

  // Daily trends map
  const dailyTrendsMap = {};

  pickups.forEach((p) => {
    const isCompleted = p.status === "completed";
    const isPending = ["requested", "assigned", "on_the_way", "arrived"].includes(p.status);
    const isCancelled = p.status === "cancelled";
    const isRejected = p.status === "rejected";

    if (isCompleted) completedCount++;
    if (isPending) pendingCount++;
    if (isCancelled) cancelledCount++;
    if (isRejected) rejectedCount++;

    const kg = isCompleted && typeof p.wasteQuantity === "number" ? p.wasteQuantity : 0;
    if (isCompleted) {
      totalVerifiedWasteKg += kg;
      if (categoryMap[p.wasteType]) {
        categoryMap[p.wasteType].verifiedKg += kg;
      }
    }

    if (categoryMap[p.wasteType]) {
      categoryMap[p.wasteType].count += 1;
    }

    // Daily trend tracking
    const dayKey = p.createdAt.toISOString().slice(0, 10);
    if (!dailyTrendsMap[dayKey]) {
      dailyTrendsMap[dayKey] = { date: dayKey, total: 0, completed: 0, wasteKg: 0 };
    }
    dailyTrendsMap[dayKey].total += 1;
    if (isCompleted) {
      dailyTrendsMap[dayKey].completed += 1;
      dailyTrendsMap[dayKey].wasteKg += kg;
    }

    // Collector performance tracking
    const assignment = p.assignments?.[0];
    const driver = assignment?.vehicle?.driver;
    const vehicleReg = assignment?.vehicle?.registrationNo;

    if (driver) {
      if (!collectorMap[driver.id]) {
        collectorMap[driver.id] = {
          collectorId: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          vehicleReg: vehicleReg || "Unassigned",
          assignedPickupsCount: 0,
          completedPickupsCount: 0,
          totalWasteCollectedKg: 0,
        };
      }
      collectorMap[driver.id].assignedPickupsCount += 1;
      if (isCompleted) {
        collectorMap[driver.id].completedPickupsCount += 1;
        collectorMap[driver.id].totalWasteCollectedKg += kg;
      }
    }
  });

  const completionRate = totalPickups > 0 ? Number(((completedCount / totalPickups) * 100).toFixed(1)) : 0;
  totalVerifiedWasteKg = Number(totalVerifiedWasteKg.toFixed(1));

  const wasteByCategory = Object.values(categoryMap).map((c) => ({
    category: c.category,
    label: c.label,
    count: c.count,
    verifiedKg: Number(c.verifiedKg.toFixed(1)),
    percentage:
      totalVerifiedWasteKg > 0 ? Number(((c.verifiedKg / totalVerifiedWasteKg) * 100).toFixed(1)) : 0,
  }));

  const timelineTrends = Object.values(dailyTrendsMap).sort((a, b) => a.date.localeCompare(b.date));

  // C. Fleet Analytics
  const totalVehicles = allVehicles.length;
  const activeVehiclesCount = allVehicles.filter((v) => v.isActive).length;
  const inactiveVehiclesCount = totalVehicles - activeVehiclesCount;
  const assignedVehiclesCount = allVehicles.filter((v) => v.driverId !== null).length;
  const fleetUtilizationRate =
    totalVehicles > 0 ? Number(((assignedVehiclesCount / totalVehicles) * 100).toFixed(1)) : 0;

  const fleetRoster = allVehicles.map((v) => {
    const perf = collectorMap[v.driverId] || {
      completedPickupsCount: 0,
      totalWasteCollectedKg: 0,
    };
    return {
      id: v.id,
      registrationNo: v.registrationNo,
      type: v.type,
      capacityKg: v.capacity,
      isActive: v.isActive,
      collectorName: v.driver?.name || "Unassigned",
      collectorEmail: v.driver?.email || "N/A",
      completedPickupsCount: perf.completedPickupsCount,
      totalWasteCollectedKg: Number(perf.totalWasteCollectedKg.toFixed(1)),
    };
  });

  const collectorPerformance = Object.values(collectorMap).map((c) => ({
    ...c,
    totalWasteCollectedKg: Number(c.totalWasteCollectedKg.toFixed(1)),
    successRate:
      c.assignedPickupsCount > 0
        ? Number(((c.completedPickupsCount / c.assignedPickupsCount) * 100).toFixed(1))
        : 0,
  }));

  // D. Citizen Analytics
  const activeCitizensCount = activeCitizensGroup.length;
  const citizenParticipationRate =
    totalRegisteredCitizens > 0
      ? Number(((activeCitizensCount / totalRegisteredCitizens) * 100).toFixed(1))
      : 0;

  // E. Rewards Analytics
  const totalPointsDistributed = pointsAgg._sum.pointsEarned || 0;
  const totalPointsRedeemed = redemptionsAgg._sum.pointsSpent || 0;
  const totalRedemptionsCount = redemptionsAgg._count._all || 0;

  // All-time points issued
  const allTimePointsTotal = await prisma.pointsLedger.aggregate({
    _sum: { pointsEarned: true },
  });

  const rewardCatalogue = allRewards.map((r) => ({
    id: r.id,
    name: r.name,
    pointsRequired: r.pointsRequired,
    stock: r.stock,
    redemptionsCount: r._count.redemptions,
  }));

  const topRedeemedRewards = [...rewardCatalogue].sort((a, b) => b.redemptionsCount - a.redemptionsCount);

  // Badge distribution
  const allBadges = await prisma.badge.findMany();
  const badgeMap = {};
  badgeCounts.forEach((b) => {
    badgeMap[b.badgeId] = b._count._all;
  });
  const badgeDistribution = allBadges.map((b) => ({
    name: b.name,
    minPoints: b.minPoints,
    description: b.description,
    unlockedCount: badgeMap[b.id] || 0,
  }));

  // Clean, serialized pickup records for export
  const pickupRecords = pickups.map((p) => ({
    id: p.id,
    date: p.createdAt.toISOString().slice(0, 10),
    createdAt: p.createdAt,
    citizenName: p.user?.name || "Citizen",
    citizenEmail: p.user?.email || "N/A",
    citizenPhone: p.user?.phone || "N/A",
    category: p.wasteType,
    categoryLabel: getWasteCategoryLabel(p.wasteType),
    quantityBand: p.quantityBand,
    wasteQuantityKg: p.wasteQuantity !== null ? Number(p.wasteQuantity.toFixed(1)) : null,
    status: p.status,
    address: p.address,
    vehicleReg: p.assignments?.[0]?.vehicle?.registrationNo || "Unassigned",
    collectorName: p.assignments?.[0]?.vehicle?.driver?.name || "Unassigned",
    rejectionReason: p.rejectionReason,
  }));

  return {
    reportingPeriod: {
      period: queryOptions.period || "30d",
      label: periodLabel,
      startDate: gte ? gte.toISOString().slice(0, 10) : "Inception",
      endDate: lte ? lte.toISOString().slice(0, 10) : "Present",
      categoryFilter: category || "All Categories",
      generatedAt: new Date().toISOString(),
    },
    pickupAnalytics: {
      totalPickups,
      completedPickups: completedCount,
      pendingPickups: pendingCount,
      cancelledPickups: cancelledCount,
      rejectedPickups: rejectedCount,
      completionRate,
      categoryDistribution: wasteByCategory,
      timelineTrends,
    },
    wasteCollectionAnalytics: {
      totalVerifiedWasteKg,
      wasteByCategory,
      collectorPerformance,
    },
    fleetAnalytics: {
      totalVehicles,
      activeVehiclesCount,
      inactiveVehiclesCount,
      assignedVehiclesCount,
      fleetUtilizationRate,
      fleetRoster,
    },
    citizenAnalytics: {
      totalRegisteredCitizens,
      activeCitizensCount,
      citizenParticipationRate,
      pointsDistributedInPeriod: totalPointsDistributed,
      allTimePointsDistributed: allTimePointsTotal._sum.pointsEarned || 0,
      totalRedemptionsCount,
      totalPointsRedeemed,
    },
    rewardsAnalytics: {
      totalPointsDistributed,
      totalPointsRedeemed,
      rewardCatalogue,
      topRedeemedRewards,
      badgeDistribution,
    },
    pickupRecords,
  };
}

module.exports = {
  parseDateRange,
  getWasteCategoryLabel,
  getCitizenReportData,
  getAdminReportData,
};
