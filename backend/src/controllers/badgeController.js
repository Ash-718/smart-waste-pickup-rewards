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

const { createBadgeSchema } = require("../validation/schemas");
const { HttpError } = require("../middleware/errorHandler");

const create = asyncHandler(async (req, res) => {
  const data = createBadgeSchema.parse(req.body);

  const existing = await prisma.badge.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new HttpError(409, "A badge with this name already exists");
  }

  const badge = await prisma.badge.create({
    data: {
      name: data.name,
      minPoints: data.minPoints,
      description: data.description || null,
    },
  });

  res.status(201).json({ badge });
});

module.exports = { list, create };
