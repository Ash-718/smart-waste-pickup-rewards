const { pointsForQuantityBand } = require("../config/constants");
const { evaluateBadgesForUser } = require("./badgeService");

// Transitions a pickup to 'completed', credits points, and evaluates badges
// atomically so a crash mid-way never leaves points credited without a
// ledger row, or a ledger row without a badge check.
async function completePickupAndAwardPoints(tx, pickup) {
  const pointsEarned = pointsForQuantityBand(pickup.quantityBand);

  const updatedPickup = await tx.pickup.update({
    where: { id: pickup.id },
    data: { status: "completed" },
  });

  const ledgerEntry = await tx.pointsLedger.create({
    data: {
      pickupId: pickup.id,
      userId: pickup.userId,
      pointsEarned,
    },
  });

  const newBadges = await evaluateBadgesForUser(tx, pickup.userId);

  return { pickup: updatedPickup, ledgerEntry, newBadges };
}

// Available balance = total earned minus total already spent on redemptions.
// Points are never stored as a mutable column, so this is always derived.
async function getAvailablePoints(tx, userId) {
  const [earned, spent] = await Promise.all([
    tx.pointsLedger.aggregate({ where: { userId }, _sum: { pointsEarned: true } }),
    tx.rewardRedemption.aggregate({ where: { userId }, _sum: { pointsSpent: true } }),
  ]);
  return (earned._sum.pointsEarned || 0) - (spent._sum.pointsSpent || 0);
}

module.exports = { completePickupAndAwardPoints, getAvailablePoints };
