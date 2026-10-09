const bcrypt = require("bcryptjs");
const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const { createCollectorSchema } = require("../validation/schemas");
const { WASTE_TYPES, estimatedWasteKg } = require("../config/constants");
const { getAvailablePoints } = require("../services/pointsService");

// GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "citizen" },
    orderBy: { createdAt: "desc" },
    include: {
      pickups: {
        select: {
          id: true,
          status: true,
          wasteQuantity: true,
          quantityBand: true,
          createdAt: true,
        },
      },
      pointsLedger: {
        select: { pointsEarned: true },
      },
      userBadges: {
        select: { badgeId: true },
      },
      rewardRedemptions: {
        select: { id: true },
      },
    },
  });

  const formatted = users.map((u) => {
    const completedPickups = u.pickups.filter((p) => p.status === "completed");
    const rejectedPickups = u.pickups.filter((p) => p.status === "rejected");
    const totalWasteKg = completedPickups.reduce(
      (sum, p) => sum + (p.wasteQuantity || estimatedWasteKg(p.quantityBand)),
      0
    );
    const totalPointsEarned = u.pointsLedger.reduce((sum, l) => sum + l.pointsEarned, 0);

    const sortedPickups = [...u.pickups].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const lastPickupDate = sortedPickups[0]?.createdAt || null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      totalPickups: u.pickups.length,
      completedPickups: completedPickups.length,
      rejectedPickups: rejectedPickups.length,
      totalWasteKg: Number(totalWasteKg.toFixed(1)),
      totalPointsEarned,
      rewardsRedeemedCount: u.rewardRedemptions.length,
      badgesCount: u.userBadges.length,
      lastPickupDate,
    };
  });

  res.json({ users: formatted });
});

// GET /api/admin/users/:id
const getUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      pickups: {
        orderBy: { createdAt: "desc" },
        include: {
          assignedAdmin: { select: { id: true, name: true, role: true } },
          pointsLedgerEntry: true,
        },
      },
      pointsLedger: {
        orderBy: { createdAt: "desc" },
      },
      userBadges: {
        include: { badge: true },
        orderBy: { earnedAt: "desc" },
      },
      rewardRedemptions: {
        include: { reward: true },
        orderBy: { redeemedAt: "desc" },
      },
    },
  });

  if (!user) throw new HttpError(404, "User not found");

  const completedPickups = user.pickups.filter((p) => p.status === "completed");
  const rejectedPickups = user.pickups.filter((p) => p.status === "rejected");
  const pendingPickups = user.pickups.filter((p) => p.status === "requested");
  const assignedPickups = user.pickups.filter((p) => p.status === "assigned");

  const totalWasteKg = completedPickups.reduce(
    (sum, p) => sum + (p.wasteQuantity || estimatedWasteKg(p.quantityBand)),
    0
  );
  const totalPointsEarned = user.pointsLedger.reduce((sum, l) => sum + l.pointsEarned, 0);
  const availablePoints = await getAvailablePoints(prisma, user.id);

  // Waste category breakdown
  const categoryMap = {};
  WASTE_TYPES.forEach((w) => {
    categoryMap[w.value] = { wasteType: w.value, label: w.label, weightKg: 0, count: 0 };
  });

  completedPickups.forEach((p) => {
    if (categoryMap[p.wasteType]) {
      categoryMap[p.wasteType].weightKg += p.wasteQuantity || estimatedWasteKg(p.quantityBand);
      categoryMap[p.wasteType].count += 1;
    }
  });

  const wasteCategoryBreakdown = Object.values(categoryMap).map((c) => ({
    ...c,
    weightKg: Number(c.weightKg.toFixed(1)),
  }));

  // Waste contribution over time (last 6 months)
  const now = new Date();
  const contributionOverTime = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const monthLabel = d.toLocaleString("default", { month: "short" });

    const monthPickups = user.pickups.filter((p) => {
      const pDate = new Date(p.createdAt);
      return pDate.getFullYear() === yr && pDate.getMonth() === mo;
    });

    const mCompleted = monthPickups.filter((p) => p.status === "completed");
    const mWeight = mCompleted.reduce(
      (sum, p) => sum + (p.wasteQuantity || estimatedWasteKg(p.quantityBand)),
      0
    );

    contributionOverTime.push({
      key: `${yr}-${String(mo + 1).padStart(2, "0")}`,
      monthLabel,
      weightKg: Number(mWeight.toFixed(1)),
      pickupsCount: monthPickups.length,
      completedCount: mCompleted.length,
    });
  }

  const lastPickup = user.pickups[0];

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    },
    metrics: {
      totalWasteKg: Number(totalWasteKg.toFixed(1)),
      totalPickups: user.pickups.length,
      completedPickups: completedPickups.length,
      rejectedPickups: rejectedPickups.length,
      pendingPickups: pendingPickups.length,
      assignedPickups: assignedPickups.length,
      totalPointsEarned,
      availablePoints,
      rewardsRedeemedCount: user.rewardRedemptions.length,
      badgesCount: user.userBadges.length,
      lastPickupDate: lastPickup?.createdAt || null,
    },
    wasteCategoryBreakdown,
    contributionOverTime,
    badges: user.userBadges.map((ub) => ({
      ...ub.badge,
      earnedAt: ub.earnedAt,
    })),
    rewardRedemptions: user.rewardRedemptions.map((r) => ({
      id: r.id,
      rewardName: r.reward.name,
      pointsSpent: r.pointsSpent,
      redemptionCode: r.redemptionCode,
      redeemedAt: r.redeemedAt,
    })),
    recentPickups: user.pickups,
  });
});

// GET /api/admin/collectors
const listCollectors = asyncHandler(async (req, res) => {
  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["collector", "admin"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      assignedPickups: {
        where: { status: "assigned" },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const collectors = staff.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    role: s.role,
    activeAssignmentsCount: s.assignedPickups.length,
  }));

  res.json({ collectors });
});

// POST /api/admin/collectors
const createCollector = asyncHandler(async (req, res) => {
  const data = createCollectorSchema.parse(req.body);

  const [existingEmail, existingPhone] = await Promise.all([
    data.email ? prisma.user.findUnique({ where: { email: data.email } }) : null,
    data.phone ? prisma.user.findUnique({ where: { phone: data.phone } }) : null,
  ]);
  if (existingEmail) throw new HttpError(409, "User with this email already exists");
  if (existingPhone) throw new HttpError(409, "User with this phone already exists");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const collector = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      passwordHash,
      role: "collector",
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  res.status(201).json({ collector });
});

module.exports = {
  listUsers,
  getUserProfile,
  listCollectors,
  createCollector,
};
