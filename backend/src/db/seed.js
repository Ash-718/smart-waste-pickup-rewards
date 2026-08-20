require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./client");
const { BADGES, STARTER_REWARDS } = require("../config/constants");

async function main() {
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: { minPoints: badge.minPoints, description: badge.description },
      create: badge,
    });
  }
  console.log(`Seeded ${BADGES.length} badges.`);

  for (const reward of STARTER_REWARDS) {
    const existing = await prisma.reward.findFirst({ where: { name: reward.name } });
    if (!existing) {
      await prisma.reward.create({ data: reward });
    }
  }
  console.log(`Seeded ${STARTER_REWARDS.length} starter rewards.`);

  const adminEmail = "admin@wastewise.local";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("Admin@123", 10);
    await prisma.user.create({
      data: {
        name: "Pruthvi ZeroWaste Admin",
        email: adminEmail,
        passwordHash,
        role: "admin",
      },
    });
    console.log(`Seeded admin account: ${adminEmail} / Admin@123 (change this after first login)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
