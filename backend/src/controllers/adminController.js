const prisma = require("../db/client");
const { asyncHandler } = require("../middleware/errorHandler");

// All figures pre-aggregated server-side so the dashboard client never has
// to compute totals/group-bys itself.
const summary = asyncHandler(async (req, res) => {
  const [
    statusCounts,
    wasteTypeCounts,
    totalPointsIssued,
    totalUsers,
    totalRedemptions,
    pickupsPerDay,
  ] = await Promise.all([
    prisma.pickup.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.pickup.groupBy({
      by: ["wasteType"],
      where: { status: "completed" },
      _count: { _all: true },
    }),
    prisma.pointsLedger.aggregate({ _sum: { pointsEarned: true } }),
    prisma.user.count({ where: { role: "citizen" } }),
    prisma.rewardRedemption.count(),
    prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "updated_at")::date AS day, COUNT(*)::int AS count
      FROM pickups
      WHERE status = 'completed' AND "updated_at" >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `,
  ]);

  res.json({
    pickupsByStatus: statusCounts.map((s) => ({ status: s.status, count: s._count._all })),
    wasteCollectedByType: wasteTypeCounts.map((w) => ({
      wasteType: w.wasteType,
      count: w._count._all,
    })),
    totalPointsIssued: totalPointsIssued._sum.pointsEarned || 0,
    totalCitizens: totalUsers,
    totalRedemptions,
    completedPickupsLast30Days: pickupsPerDay,
  });
});

module.exports = { summary };
