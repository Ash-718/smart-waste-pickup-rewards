const prisma = require("../db/client");
const { asyncHandler } = require("../middleware/errorHandler");
const { getReminderStatus } = require("../services/reminderService");
const { getAvailablePoints } = require("../services/pointsService");

const balance = asyncHandler(async (req, res) => {
  const available = await getAvailablePoints(prisma, req.user.id);
  const reminder = await getReminderStatus(prisma, req.user.id);

  res.json({ balance: available, reminder });
});

const history = asyncHandler(async (req, res) => {
  const entries = await prisma.pointsLedger.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: { pickup: { select: { id: true, wasteType: true, quantityBand: true } } },
  });
  res.json({ entries });
});

module.exports = { balance, history };
