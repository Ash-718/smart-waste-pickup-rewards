const prisma = require("../db/client");
const { asyncHandler } = require("../middleware/errorHandler");

const list = asyncHandler(async (req, res) => {
  const [badges, earned] = await Promise.all([
    prisma.badge.findMany({ orderBy: { minPoints: "asc" } }),
    prisma.userBadge.findMany({ where: { userId: req.user.id } }),
  ]);
  const earnedIds = new Set(earned.map((e) => e.badgeId));
  const earnedAtByBadgeId = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));

  res.json({
    badges: badges.map((b) => ({
      ...b,
      earned: earnedIds.has(b.id),
      earnedAt: earnedAtByBadgeId.get(b.id) || null,
    })),
  });
});

module.exports = { list };
