// Awards any badges the user has newly qualified for, based on total points.
// Must be called with the same transaction client that credited the points,
// so the balance read reflects the just-added ledger entry.
async function evaluateBadgesForUser(tx, userId) {
  const balance = await tx.pointsLedger.aggregate({
    where: { userId },
    _sum: { pointsEarned: true },
  });
  const totalPoints = balance._sum.pointsEarned || 0;

  const eligibleBadges = await tx.badge.findMany({
    where: { minPoints: { lte: totalPoints } },
  });
  if (eligibleBadges.length === 0) return [];

  const alreadyEarned = await tx.userBadge.findMany({
    where: { userId, badgeId: { in: eligibleBadges.map((b) => b.id) } },
    select: { badgeId: true },
  });
  const alreadyEarnedIds = new Set(alreadyEarned.map((b) => b.badgeId));

  const newBadges = eligibleBadges.filter((b) => !alreadyEarnedIds.has(b.id));
  if (newBadges.length === 0) return [];

  await tx.userBadge.createMany({
    data: newBadges.map((b) => ({ userId, badgeId: b.id })),
    skipDuplicates: true,
  });

  return newBadges;
}

module.exports = { evaluateBadgesForUser };
