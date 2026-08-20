const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const {
  createPickupSchema,
  assignPickupSchema,
  updateStatusSchema,
} = require("../validation/schemas");
const { PICKUP_STATUSES } = require("../config/constants");
const { completePickupAndAwardPoints } = require("../services/pointsService");

const create = asyncHandler(async (req, res) => {
  const data = createPickupSchema.parse(req.body);

  const pickup = await prisma.pickup.create({
    data: {
      userId: req.user.id,
      wasteType: data.wasteType,
      quantityBand: data.quantityBand,
      address: data.address,
      slotPeriod: data.slotPeriod,
      requestedDate: data.requestedDate,
      photoUrl: data.photoUrl || null,
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
  if (status) {
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
      assignedAdmin: { select: { id: true, name: true } },
    },
  });

  res.json({ pickups });
});

const getById = asyncHandler(async (req, res) => {
  const pickup = await prisma.pickup.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      assignedAdmin: { select: { id: true, name: true } },
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
  const assignedAdminId = data.adminId || req.user.id;

  if (data.adminId) {
    const admin = await prisma.user.findUnique({ where: { id: data.adminId } });
    if (admin?.role !== "admin") {
      throw new HttpError(400, "adminId must reference an existing admin user");
    }
  }

  const pickup = await prisma.pickup.findUnique({ where: { id: req.params.id } });
  if (!pickup) throw new HttpError(404, "Pickup not found");

  // updateMany's where guards the completed/cancelled check atomically at
  // write time, closing the race where a concurrent completion commits
  // between the read above and this write.
  const result = await prisma.pickup.updateMany({
    where: { id: req.params.id, status: { notIn: ["completed", "cancelled"] } },
    data: {
      status: "assigned",
      assignedAdminId,
      ...(data.slotPeriod ? { slotPeriod: data.slotPeriod } : {}),
      ...(data.requestedDate ? { requestedDate: data.requestedDate } : {}),
    },
  });
  if (result.count === 0) {
    throw new HttpError(400, `Cannot assign a pickup that is already ${pickup.status}`);
  }

  const updated = await prisma.pickup.findUnique({ where: { id: req.params.id } });

  res.json({ pickup: updated });
});

const updateStatus = asyncHandler(async (req, res) => {
  const data = updateStatusSchema.parse(req.body);

  const pickup = await prisma.pickup.findUnique({ where: { id: req.params.id } });
  if (!pickup) throw new HttpError(404, "Pickup not found");
  if (pickup.status === "completed" || pickup.status === "cancelled") {
    throw new HttpError(400, `Pickup is already ${pickup.status}`);
  }

  if (data.status === "completed") {
    const result = await prisma.$transaction((tx) => completePickupAndAwardPoints(tx, pickup));
    return res.json({
      pickup: result.pickup,
      pointsEarned: result.ledgerEntry.pointsEarned,
      newBadges: result.newBadges,
    });
  }

  const updated = await prisma.pickup.update({
    where: { id: req.params.id },
    data: { status: data.status },
  });
  res.json({ pickup: updated });
});

module.exports = { create, list, getById, assign, updateStatus };
