require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../src/db/client");
const { assignVehicleToPickup } = require("../src/services/assignmentService");
const demoConfig = require("./demo.config.json");

// Production safeguard: refuse execution in production
if (process.env.NODE_ENV === "production") {
  console.error("❌ Refusing to run demo seed script in production environment.");
  process.exit(1);
}

const isCleanup = process.argv.includes("--cleanup");

const DEMO_CITIZEN_EMAIL = process.env.DEMO_CITIZEN_EMAIL || "demo_citizen@example.com";
const DEMO_CITIZEN_PASSWORD = process.env.DEMO_CITIZEN_PASSWORD || "DemoCitizen@123";

const DEMO_COLLECTOR_EMAIL = process.env.DEMO_COLLECTOR_EMAIL || "demo_collector@example.com";
const DEMO_COLLECTOR_PASSWORD = process.env.DEMO_COLLECTOR_PASSWORD || "DemoCollector@123";

const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "demo_admin@example.com";

const DEMO_VEHICLE_REG = process.env.DEMO_VEHICLE_REG || "DEMO-TRUCK-01";

const START_COORDS = {
  lat: parseFloat(process.env.DEMO_START_LAT || demoConfig.start.lat),
  lng: parseFloat(process.env.DEMO_START_LNG || demoConfig.start.lng),
  address: process.env.DEMO_START_ADDRESS || demoConfig.start.address,
};

const DEST_COORDS = {
  lat: parseFloat(process.env.DEMO_DEST_LAT || demoConfig.destination.lat),
  lng: parseFloat(process.env.DEMO_DEST_LNG || demoConfig.destination.lng),
  address: process.env.DEMO_DEST_ADDRESS || demoConfig.destination.address,
};

async function cleanupDemoRecords() {
  console.log("🧹 [SIMULATED DEMO] Cleaning up DEMO- records only...");

  // 1. Find demo vehicles (prefixed DEMO-)
  const demoVehicles = await prisma.vehicle.findMany({
    where: { registrationNo: { startsWith: "DEMO-" } },
    select: { id: true, registrationNo: true },
  });
  const vehicleIds = demoVehicles.map((v) => v.id);

  // 2. Find demo users (emails starting with demo_)
  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "demo_" } },
        { email: { in: [DEMO_CITIZEN_EMAIL, DEMO_COLLECTOR_EMAIL, DEMO_ADMIN_EMAIL] } },
      ],
    },
    select: { id: true, email: true },
  });
  const userIds = demoUsers.map((u) => u.id);

  // 3. Find demo pickups created by demo users or assigned to demo vehicles
  const demoPickups = await prisma.pickup.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { assignments: { some: { vehicleId: { in: vehicleIds } } } },
      ],
    },
    select: { id: true },
  });
  const pickupIds = demoPickups.map((p) => p.id);

  if (pickupIds.length > 0) {
    await prisma.vehicleLocation.deleteMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    await prisma.pointsLedger.deleteMany({
      where: { pickupId: { in: pickupIds } },
    });
    await prisma.pickupAssignment.deleteMany({
      where: { pickupId: { in: pickupIds } },
    });
    await prisma.pickup.deleteMany({
      where: { id: { in: pickupIds } },
    });
  }

  if (vehicleIds.length > 0) {
    await prisma.vehicleLocation.deleteMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    await prisma.pickupAssignment.deleteMany({
      where: { vehicleId: { in: vehicleIds } },
    });
    await prisma.vehicle.deleteMany({
      where: { id: { in: vehicleIds } },
    });
  }

  if (userIds.length > 0) {
    await prisma.rewardRedemption.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.userBadge.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.pointsLedger.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }

  console.log(`✓ Cleaned ${pickupIds.length} demo pickups.`);
  console.log(`✓ Cleaned ${vehicleIds.length} demo vehicles.`);
  console.log(`✓ Cleaned ${userIds.length} demo user accounts.`);
  console.log("✨ Demo cleanup complete.");
}

async function seedDemo() {
  console.log("🌱 [SIMULATED DEMO] Initializing repeatable live tracking demo environment...");

  // 1. Clean previous active demo pickups to maintain idempotence
  await cleanupDemoRecords();

  const citizenHash = await bcrypt.hash(DEMO_CITIZEN_PASSWORD, 10);
  const collectorHash = await bcrypt.hash(DEMO_COLLECTOR_PASSWORD, 10);

  // 2. Demo Citizen
  const citizen = await prisma.user.upsert({
    where: { email: DEMO_CITIZEN_EMAIL },
    update: { name: "Demo Citizen", role: "citizen" },
    create: {
      name: "Demo Citizen",
      email: DEMO_CITIZEN_EMAIL,
      phone: "+919800000001",
      passwordHash: citizenHash,
      role: "citizen",
    },
  });

  // 3. Demo Collector (Driver)
  const collector = await prisma.user.upsert({
    where: { email: DEMO_COLLECTOR_EMAIL },
    update: { name: "Demo Collector (Driver)", role: "collector" },
    create: {
      name: "Demo Collector (Driver)",
      email: DEMO_COLLECTOR_EMAIL,
      phone: "+919800000002",
      passwordHash: collectorHash,
      role: "collector",
    },
  });

  // 4. Admin Account (reuse existing admin if present; otherwise create demo admin with runtime password)
  let admin = await prisma.user.findFirst({
    where: { role: "admin" },
  });
  let generatedAdminPassword = null;

  if (!admin) {
    const crypto = require("crypto");
    generatedAdminPassword = crypto.randomBytes(8).toString("hex") + "A1!";
    const adminHash = await bcrypt.hash(generatedAdminPassword, 10);
    admin = await prisma.user.create({
      data: {
        name: "Demo Dispatch Admin",
        email: DEMO_ADMIN_EMAIL,
        phone: "+919800000003",
        passwordHash: adminHash,
        role: "admin",
      },
    });
  }

  // 5. Demo Vehicle (prefixed DEMO-)
  const vehicle = await prisma.vehicle.upsert({
    where: { registrationNo: DEMO_VEHICLE_REG },
    update: {
      driverId: collector.id,
      type: "Electric Mini Van (Simulated Demo)",
      capacity: 500,
      isActive: true,
      currentLat: START_COORDS.lat,
      currentLng: START_COORDS.lng,
      currentSpeed: 0,
      currentHeading: 90,
      lastLocationAt: null, // Initialized without stale fake timestamp until simulator starts
    },
    create: {
      registrationNo: DEMO_VEHICLE_REG,
      type: "Electric Mini Van (Simulated Demo)",
      capacity: 500,
      driverId: collector.id,
      isActive: true,
      currentLat: START_COORDS.lat,
      currentLng: START_COORDS.lng,
      currentSpeed: 0,
      currentHeading: 90,
      lastLocationAt: null,
    },
  });

  // 6. Create Demo Pickup in Sangli operating zone
  const pickup = await prisma.pickup.create({
    data: {
      userId: citizen.id,
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "MEDIUM",
      wasteQuantity: 4.5,
      address: DEST_COORDS.address,
      latitude: DEST_COORDS.lat,
      longitude: DEST_COORDS.lng,
      slotPeriod: "MORNING",
      requestedDate: new Date(),
      status: "requested",
    },
  });

  // 7. Assign demo vehicle using the normal application assignment path
  const assignmentResult = await assignVehicleToPickup({
    pickupId: pickup.id,
    vehicleId: vehicle.id,
    collectorId: collector.id,
    adminUserId: admin.id,
  });

  console.log("\n============================================================");
  console.log("🚛 [SIMULATED DEMO] Live Tracking Demo Environment Ready!");
  console.log("============================================================");
  console.log(`📌 Pickup ID:        ${pickup.id}`);
  console.log(`📍 Destination:      ${DEST_COORDS.address} (${DEST_COORDS.lat}, ${DEST_COORDS.lng})`);
  console.log(`🚚 Demo Vehicle:     ${vehicle.registrationNo} (Driver: ${collector.name})`);
  console.log(`🚥 Pickup Status:    ${assignmentResult.pickup.status} (Assignment ID: ${assignmentResult.assignment.id})`);
  console.log("\n👤 Demo Login Credentials (all fake emails):");
  console.log(`   Citizen:    ${DEMO_CITIZEN_EMAIL} / ${DEMO_CITIZEN_PASSWORD}`);
  console.log(`   Collector:  ${DEMO_COLLECTOR_EMAIL} / ${DEMO_COLLECTOR_PASSWORD}`);
  if (generatedAdminPassword) {
    console.log(`   Admin:      ${admin.email} / ${generatedAdminPassword} (generated at runtime)`);
  } else {
    console.log(`   Admin:      ${admin.email} (configured admin credentials)`);
  }
  console.log("\n🚀 Next Step to Run the Live Simulation:");
  console.log(`   npm run demo:drive -- --pickup=${pickup.id}`);
  console.log("============================================================\n");
}

async function main() {
  if (isCleanup) {
    await cleanupDemoRecords();
  } else {
    await seedDemo();
  }
}

main()
  .catch((err) => {
    console.error("❌ Demo seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
