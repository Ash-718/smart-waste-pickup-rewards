require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./client");
const { BADGES, STARTER_REWARDS } = require("../config/constants");

// Demo city coordinates: Miraj (with primary vehicle placed 2-3 km from sample pickup)
const DEMO_CITY = {
  name: "Miraj",
  samplePickup: {
    lat: 16.8413,
    lng: 74.6016,
    address: "Station Road, Near Miraj Junction, Miraj, Maharashtra 416410",
  },
  hub: {
    lat: 16.8580, // ~2.3 km northeast from sample pickup
    lng: 74.6150,
  },
};

async function main() {
  // Production guard
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_SEED) {
    throw new Error(
      "SECURITY ALERT: Seeding is blocked in production. Set ALLOW_PROD_SEED=true to force."
    );
  }

  // 1. Seed Badges (idempotent upsert by name)
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: { minPoints: badge.minPoints, description: badge.description },
      create: badge,
    });
  }
  console.log(`✓ Seeded ${BADGES.length} badges.`);

  // 2. Seed Starter Rewards (idempotent find + create)
  for (const reward of STARTER_REWARDS) {
    const existing = await prisma.reward.findFirst({ where: { name: reward.name } });
    if (!existing) {
      await prisma.reward.create({ data: reward });
    }
  }
  console.log(`✓ Seeded ${STARTER_REWARDS.length} starter rewards.`);

  // 3. Admin Account (idempotent upsert by email)
  const adminEmail = "admin@wastewise.local";
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "admin" },
    create: {
      name: "Pruthvi ZeroWaste Admin",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "admin",
    },
  });
  console.log(`✓ Upserted admin account: ${adminEmail}`);

  // 4. Collector / Driver Account (idempotent upsert by email)
  const driverEmail = "driver@wastewise.local";
  const driverPasswordHash = await bcrypt.hash("Driver@123", 10);
  const driver = await prisma.user.upsert({
    where: { email: driverEmail },
    update: { role: "collector" },
    create: {
      name: "Ramesh Shinde (Fleet Collector)",
      email: driverEmail,
      phone: "+919820112233",
      passwordHash: driverPasswordHash,
      role: "collector",
    },
  });
  console.log(`✓ Upserted collector/driver account: ${driverEmail}`);

  // 5. Citizen Account (idempotent upsert by email)
  const citizenEmail = "citizen@wastewise.local";
  const citizenPasswordHash = await bcrypt.hash("Citizen@123", 10);
  const citizen = await prisma.user.upsert({
    where: { email: citizenEmail },
    update: { role: "citizen" },
    create: {
      name: "Aarav Mehta",
      email: citizenEmail,
      phone: "+919820998877",
      passwordHash: citizenPasswordHash,
      role: "citizen",
    },
  });
  console.log(`✓ Upserted citizen account: ${citizenEmail}`);

  // 6. Fleet Vehicles in Demo City (Miraj) - idempotent upsert by registration_no
  const reg1 = "MH-02-WW-1001";
  const vehicle1 = await prisma.vehicle.upsert({
    where: { registrationNo: reg1 },
    update: {
      driverId: driver.id,
      isActive: true,
      currentLat: DEMO_CITY.hub.lat,
      currentLng: DEMO_CITY.hub.lng,
      currentSpeed: 0,
      currentHeading: 90,
      lastLocationAt: new Date(),
    },
    create: {
      registrationNo: reg1,
      type: "Electric Mini Van",
      capacity: 500,
      driverId: driver.id,
      isActive: true,
      currentLat: DEMO_CITY.hub.lat,
      currentLng: DEMO_CITY.hub.lng,
      currentSpeed: 0,
      currentHeading: 90,
      lastLocationAt: new Date(),
    },
  });
  console.log(`✓ Upserted primary vehicle ${reg1} assigned to ${driver.name} at Miraj Hub`);

  const reg2 = "MH-02-WW-2002";
  await prisma.vehicle.upsert({
    where: { registrationNo: reg2 },
    update: {
      isActive: true,
      currentLat: 16.8480,
      currentLng: 74.5980,
      currentSpeed: 0,
      currentHeading: 180,
      lastLocationAt: new Date(),
    },
    create: {
      registrationNo: reg2,
      type: "Tata Ace Recycler",
      capacity: 750,
      isActive: true,
      currentLat: 16.8480,
      currentLng: 74.5980,
      currentSpeed: 0,
      currentHeading: 180,
      lastLocationAt: new Date(),
    },
  });
  console.log(`✓ Upserted secondary reserve vehicle ${reg2} in Miraj`);

  // 7. Seed an active tracked pickup with geocoded coordinates in Miraj
  const existingActivePickup = await prisma.pickup.findFirst({
    where: { userId: citizen.id, status: "assigned" },
  });

  if (!existingActivePickup) {
    const pickup = await prisma.pickup.create({
      data: {
        userId: citizen.id,
        wasteType: "MIXED_RECYCLABLES",
        quantityBand: "MEDIUM",
        wasteQuantity: 4.5,
        address: DEMO_CITY.samplePickup.address,
        latitude: DEMO_CITY.samplePickup.lat,
        longitude: DEMO_CITY.samplePickup.lng,
        slotPeriod: "MORNING",
        requestedDate: new Date(),
        status: "assigned",
        assignedAdminId: driver.id,
        assignedAt: new Date(),
      },
    });

    await prisma.pickupAssignment.create({
      data: {
        pickupId: pickup.id,
        vehicleId: vehicle1.id,
        assignedById: admin.id,
        assignedAt: new Date(),
        isActive: true,
      },
    });

    console.log(
      `✓ Seeded sample live-trackable pickup in ${DEMO_CITY.name} (ID: ${pickup.id}) assigned to vehicle ${vehicle1.registrationNo}`
    );
  } else {
    console.log(`✓ Active demo pickup already exists (ID: ${existingActivePickup.id})`);
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
