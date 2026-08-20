const crypto = require("crypto");
const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const { getAvailablePoints } = require("../services/pointsService");

const list = asyncHandler(async (req, res) => {
  const rewards = await prisma.reward.findMany({ orderBy: { pointsRequired: "asc" } });
  res.json({ rewards });
});

function generateRedemptionCode() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

const redeem = asyncHandler(async (req, res) => {
  const reward = await prisma.reward.findUnique({ where: { id: req.params.id } });
  if (!reward) throw new HttpError(404, "Reward not found");

  const result = await prisma.$transaction(async (tx) => {
    const available = await getAvailablePoints(tx, req.user.id);
    if (available < reward.pointsRequired) {
      throw new HttpError(400, "Not enough points for this reward");
    }

    const stockUpdate = await tx.reward.updateMany({
      where: { id: reward.id, stock: { gt: 0 } },
      data: { stock: { decrement: 1 } },
    });
    if (stockUpdate.count === 0) {
      throw new HttpError(400, "This reward is out of stock");
    }

    const redemption = await tx.rewardRedemption.create({
      data: {
        userId: req.user.id,
        rewardId: reward.id,
        pointsSpent: reward.pointsRequired,
        redemptionCode: generateRedemptionCode(),
      },
    });

    return redemption;
  }, { isolationLevel: "Serializable" });

  res.status(201).json({ redemption: result });
});

module.exports = { list, redeem };
