require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../src/db/client");
const { pointsForQuantityBand } = require("../src/config/constants");

// Production safeguard: refuse execution in production
if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_DEMO) {
  console.error("❌ Refusing to run demo seed script in production environment.");
  process.exit(1);
}

const isCleanup = process.argv.includes("--cleanup");

// Password constants for demo accounts
const CITIZEN_PASSWORD = process.env.DEMO_CITIZEN_PASSWORD || "DemoCitizen@123";
const COLLECTOR_PASSWORD = process.env.DEMO_COLLECTOR_PASSWORD || "DemoCollector@123";
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || "demo_admin@example.com";

// Realistic Sangli / Miraj local locations with accurate coordinates
const SANGLI_LOCATIONS = [
  {
    address: "Central Sorting & Recycling Hub, MIDC Miraj, Sangli District 416410",
    lat: 16.8580,
    lng: 74.6150,
  },
  {
    address: "Station Road, Near Miraj Junction, Sangli District, Maharashtra 416410",
    lat: 16.8413,
    lng: 74.6016,
  },
  {
    address: "Brahman Puri, Near Venkatesh Mandir, Miraj 416410",
    lat: 16.8435,
    lng: 74.6080,
  },
  {
    address: "Market Yard Road, Near APMC Market, Miraj 416410",
    lat: 16.8520,
    lng: 74.6120,
  },
  {
    address: "Gandhi Chowk, High School Road, Miraj 416410",
    lat: 16.8460,
    lng: 74.6045,
  },
  {
    address: "Wanless Hospital Road, Mission Compound, Miraj 416410",
    lat: 16.8390,
    lng: 74.6190,
  },
  {
    address: "Shivaji Nagar, Opp. City Garden, Miraj 416410",
    lat: 16.8475,
    lng: 74.6155,
  },
  {
    address: "Vishrambag Main Road, Sangli-Miraj Link, Sangli 416415",
    lat: 16.8510,
    lng: 74.5880,
  },
  {
    address: "Kupwad MIDC Phase 1, Near Water Tank, Miraj 416436",
    lat: 16.8620,
    lng: 74.6280,
  },
  {
    address: "Chandanwadi, Behind Civil Hospital, Miraj 416410",
    lat: 16.8350,
    lng: 74.6095,
  },
  {
    address: "Madhavnagar Road, Near Railway Crossing, Sangli 416406",
    lat: 16.8605,
    lng: 74.6030,
  },
  {
    address: "College Corner, Near Willingdon College, Sangli 416415",
    lat: 16.8560,
    lng: 74.5950,
  },
  {
    address: "Ram Nagar, Near MSEB Substation, Sangli 416416",
    lat: 16.8480,
    lng: 74.5820,
  },
  {
    address: "Gaon Bhag, Near Ganpati Temple, Sangli 416416",
    lat: 16.8540,
    lng: 74.5710,
  },
];

// 14 Demo Citizens
const CITIZEN_DEFINITIONS = [
  {
    email: "demo_citizen@example.com",
    name: "Demo Citizen (Aarav Mehta)",
    phone: "+919800000001",
    tag: "primary_demo_live_tracking",
  },
  {
    email: "demo_citizen_priya@example.com",
    name: "Priya Sharma",
    phone: "+919800000011",
    tag: "gold_tier_veteran",
  },
  {
    email: "demo_citizen_rohan@example.com",
    name: "Rohan Deshmukh",
    phone: "+919800000012",
    tag: "silver_tier_regular",
  },
  {
    email: "demo_citizen_ananya@example.com",
    name: "Ananya Joshi",
    phone: "+919800000013",
    tag: "bronze_tier_active",
  },
  {
    email: "demo_citizen_vikram@example.com",
    name: "Vikram More",
    phone: "+919800000014",
    tag: "bronze_tier",
  },
  {
    email: "demo_citizen_neha@example.com",
    name: "Neha Kulkarni",
    phone: "+919800000015",
    tag: "occasional_with_pending",
  },
  {
    email: "demo_citizen_aditya@example.com",
    name: "Aditya Shinde",
    phone: "+919800000016",
    tag: "has_completed_and_cancelled",
  },
  {
    email: "demo_citizen_pooja@example.com",
    name: "Pooja Patil",
    phone: "+919800000017",
    tag: "has_rejected_pickup",
  },
  {
    email: "demo_citizen_sameer@example.com",
    name: "Sameer Kadam",
    phone: "+919800000018",
    tag: "has_assigned_pickup",
  },
  {
    email: "demo_citizen_kavita@example.com",
    name: "Kavita Gaikwad",
    phone: "+919800000019",
    tag: "has_in_transit_pickup",
  },
  {
    email: "demo_citizen_rahul@example.com",
    name: "Rahul Bhosale",
    phone: "+919800000020",
    tag: "has_arrived_pickup",
  },
  {
    email: "demo_citizen_sneha@example.com",
    name: "Sneha Chavan",
    phone: "+919800000021",
    tag: "multiple_requested_pending",
  },
  {
    email: "demo_citizen_amit@example.com",
    name: "Amit Verma",
    phone: "+919800000022",
    tag: "new_onboarding_citizen",
  },
  {
    email: "demo_citizen_sunita@example.com",
    name: "Sunita Rao",
    phone: "+919800000023",
    tag: "new_zero_history_citizen",
  },
];

// 6 Demo Collectors
const COLLECTOR_DEFINITIONS = [
  {
    email: "demo_collector@example.com",
    name: "Demo Collector (Ramesh Shinde)",
    phone: "+919800000002",
    vehicleReg: "DEMO-TRUCK-01",
    vehicleType: "Electric Mini Van (Simulated Demo)",
    capacity: 500,
  },
  {
    email: "demo_collector_suresh@example.com",
    name: "Suresh Patil (Collector)",
    phone: "+919800000031",
    vehicleReg: "DEMO-TRUCK-02",
    vehicleType: "Tata Ace Recycler EV",
    capacity: 750,
  },
  {
    email: "demo_collector_vikas@example.com",
    name: "Vikas Jadhav (Collector)",
    phone: "+919800000032",
    vehicleReg: "DEMO-TRUCK-03",
    vehicleType: "Mahindra Bolero Maxi EV",
    capacity: 1000,
  },
  {
    email: "demo_collector_sachin@example.com",
    name: "Sachin Kamble (Collector)",
    phone: "+919800000033",
    vehicleReg: "DEMO-TRUCK-04",
    vehicleType: "Piaggio Ape E-City EV",
    capacity: 400,
  },
  {
    email: "demo_collector_mahesh@example.com",
    name: "Mahesh Pawar (Collector)",
    phone: "+919800000034",
    vehicleReg: "DEMO-TRUCK-05",
    vehicleType: "Ashok Leyland Dost EV",
    capacity: 1200,
  },
  {
    email: "demo_collector_ganesh@example.com",
    name: "Ganesh Shinde (Collector)",
    phone: "+919800000035",
    vehicleReg: "DEMO-TRUCK-06",
    vehicleType: "Eicher Pro EV Recycler",
    capacity: 2000,
  },
];

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
        { email: DEMO_ADMIN_EMAIL },
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

  // Delete dependencies cleanly in reverse FK order
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
  console.log("🌱 [SIMULATED DEMO] Initializing comprehensive live tracking & platform demo environment...");

  // 1. Clean previous active demo pickups to maintain idempotence
  await cleanupDemoRecords();

  const citizenHash = await bcrypt.hash(CITIZEN_PASSWORD, 10);
  const collectorHash = await bcrypt.hash(COLLECTOR_PASSWORD, 10);

  // 2. Fetch or create Admin Account (preserves existing NGO admin if present)
  let admin = await prisma.user.findFirst({
    where: { role: "admin" },
  });
  if (!admin) {
    const adminHash = await bcrypt.hash("Admin@123", 10);
    admin = await prisma.user.create({
      data: {
        name: "Demo Dispatch Admin",
        email: DEMO_ADMIN_EMAIL,
        phone: "+919800000099",
        passwordHash: adminHash,
        role: "admin",
      },
    });
  }

  // 3. Upsert Badges & Rewards reference caches
  const [allBadges, allRewards] = await Promise.all([
    prisma.badge.findMany(),
    prisma.reward.findMany(),
  ]);

  const badgeMap = new Map(allBadges.map((b) => [b.name, b]));
  const rewardMap = new Map(allRewards.map((r) => [r.name, r]));

  // 4. Create 14 Demo Citizens
  const citizens = [];
  for (const def of CITIZEN_DEFINITIONS) {
    const user = await prisma.user.create({
      data: {
        name: def.name,
        email: def.email,
        phone: def.phone,
        passwordHash: citizenHash,
        role: "citizen",
      },
    });
    citizens.push({ ...user, tag: def.tag });
  }
  console.log(`✓ Created ${citizens.length} demo citizens.`);

  // 5. Create 6 Demo Collectors & 6 Fleet Vehicles
  const collectors = [];
  const vehicles = [];
  for (let i = 0; i < COLLECTOR_DEFINITIONS.length; i++) {
    const cDef = COLLECTOR_DEFINITIONS[i];
    const collector = await prisma.user.create({
      data: {
        name: cDef.name,
        email: cDef.email,
        phone: cDef.phone,
        passwordHash: collectorHash,
        role: "collector",
      },
    });
    collectors.push(collector);

    // Initial position: vehicles spread across hubs and route points
    const initLoc = SANGLI_LOCATIONS[i % SANGLI_LOCATIONS.length];
    const vehicle = await prisma.vehicle.create({
      data: {
        registrationNo: cDef.vehicleReg,
        type: cDef.vehicleType,
        capacity: cDef.capacity,
        driverId: collector.id,
        isActive: true,
        currentLat: initLoc.lat,
        currentLng: initLoc.lng,
        currentSpeed: i < 2 ? 28 : 0,
        currentHeading: (i * 60) % 360,
        lastLocationAt: new Date(),
      },
    });
    vehicles.push(vehicle);
  }
  console.log(`✓ Created ${collectors.length} demo collectors and ${vehicles.length} fleet vehicles.`);

  // 6. Helper date generator for historical analytics distribution
  const now = new Date();
  const daysAgo = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  // 7. Seed 26 Realistic Demo Pickups spanning all waste categories & lifecycle states
  //
  // Supported Waste Categories:
  // - PAPER_CARDBOARD
  // - PLASTIC
  // - METAL
  // - GLASS
  // - E_WASTE
  // - MIXED_RECYCLABLES

  const pickupsToCreate = [
    // --- [A] Active In-Transit Pickups (Live Tracking on map) ---
    // Pickup 1: Main live tracking demo (DEMO-TRUCK-01, Ramesh)
    {
      userIndex: 0, // Aarav Mehta
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "MEDIUM",
      wasteQuantity: 4.5,
      location: SANGLI_LOCATIONS[1], // Station Road, Miraj
      slotPeriod: "MORNING",
      requestedDate: now,
      status: "on_the_way",
      vehicleIndex: 0, // DEMO-TRUCK-01
      collectorIndex: 0,
      createdAt: daysAgo(0),
      startedAt: new Date(Date.now() - 60000), // 1 min ago
    },
    // Pickup 2: Second concurrent live vehicle (DEMO-TRUCK-02, Suresh)
    {
      userIndex: 9, // Kavita Gaikwad
      wasteType: "PLASTIC",
      quantityBand: "LARGE",
      wasteQuantity: 8.2,
      location: SANGLI_LOCATIONS[6], // Shivaji Nagar, Opp City Garden
      slotPeriod: "AFTERNOON",
      requestedDate: now,
      status: "on_the_way",
      vehicleIndex: 1, // DEMO-TRUCK-02
      collectorIndex: 1,
      createdAt: daysAgo(0),
      startedAt: new Date(Date.now() - 90000), // 1.5 min ago
    },
    // Pickup 3: Arrived vehicle waiting for weighing (DEMO-TRUCK-03, Vikas)
    {
      userIndex: 10, // Rahul Bhosale
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "MEDIUM",
      wasteQuantity: 3.8,
      location: SANGLI_LOCATIONS[2], // Brahman Puri
      slotPeriod: "MORNING",
      requestedDate: now,
      status: "arrived",
      vehicleIndex: 2, // DEMO-TRUCK-03
      collectorIndex: 2,
      createdAt: daysAgo(0),
      startedAt: new Date(Date.now() - 300000),
      arrivedAt: new Date(Date.now() - 30000),
    },

    // --- [B] Assigned Pickups (Pending Departure / Queued) ---
    // Pickup 4: Assigned to DEMO-TRUCK-04
    {
      userIndex: 8, // Sameer Kadam
      wasteType: "METAL",
      quantityBand: "LARGE",
      wasteQuantity: 6.5,
      location: SANGLI_LOCATIONS[3], // Market Yard Road
      slotPeriod: "AFTERNOON",
      requestedDate: now,
      status: "assigned",
      vehicleIndex: 3, // DEMO-TRUCK-04
      collectorIndex: 3,
      createdAt: daysAgo(1),
    },
    // Pickup 5: Assigned to DEMO-TRUCK-05
    {
      userIndex: 5, // Neha Kulkarni
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "SMALL",
      wasteQuantity: 1.8,
      location: SANGLI_LOCATIONS[4], // Gandhi Chowk
      slotPeriod: "EVENING",
      requestedDate: now,
      status: "assigned",
      vehicleIndex: 4, // DEMO-TRUCK-05
      collectorIndex: 4,
      createdAt: daysAgo(1),
    },

    // --- [C] Unassigned / Requested Pickups (Pickup Queue) ---
    // Pickup 6: E-Waste request
    {
      userIndex: 11, // Sneha Chavan
      wasteType: "E_WASTE",
      quantityBand: "SMALL",
      location: SANGLI_LOCATIONS[5], // Wanless Hospital Road
      slotPeriod: "MORNING",
      requestedDate: daysAgo(-1),
      status: "requested",
      createdAt: daysAgo(0),
    },
    // Pickup 7: Glass bottles request
    {
      userIndex: 11, // Sneha Chavan
      wasteType: "GLASS",
      quantityBand: "MEDIUM",
      location: SANGLI_LOCATIONS[7], // Vishrambag Main Road
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(-1),
      status: "requested",
      createdAt: daysAgo(0),
    },
    // Pickup 8: Plastic recyclables request
    {
      userIndex: 5, // Neha Kulkarni
      wasteType: "PLASTIC",
      quantityBand: "LARGE",
      location: SANGLI_LOCATIONS[8], // Kupwad MIDC Phase 1
      slotPeriod: "MORNING",
      requestedDate: daysAgo(-2),
      status: "requested",
      createdAt: daysAgo(1),
    },
    // Pickup 9: Paper & Cardboard request
    {
      userIndex: 6, // Aditya Shinde
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "MEDIUM",
      location: SANGLI_LOCATIONS[9], // Chandanwadi
      slotPeriod: "EVENING",
      requestedDate: daysAgo(-2),
      status: "requested",
      createdAt: daysAgo(1),
    },

    // --- [D] Cancelled Pickups ---
    // Pickup 10: Cancelled by citizen
    {
      userIndex: 6, // Aditya Shinde
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "SMALL",
      location: SANGLI_LOCATIONS[10], // Madhavnagar Road
      slotPeriod: "MORNING",
      requestedDate: daysAgo(3),
      status: "cancelled",
      rejectionReason: null,
      createdAt: daysAgo(4),
    },
    // Pickup 11: Cancelled due to citizen reschedule
    {
      userIndex: 4, // Vikram More
      wasteType: "METAL",
      quantityBand: "MEDIUM",
      location: SANGLI_LOCATIONS[11], // College Corner
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(8),
      status: "cancelled",
      rejectionReason: null,
      createdAt: daysAgo(9),
    },

    // --- [E] Rejected Pickups (Audited Quality Rejection) ---
    // Pickup 12: Rejected - Unsegregated municipal waste mixed into paper
    {
      userIndex: 7, // Pooja Patil
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "LARGE",
      location: SANGLI_LOCATIONS[12], // Ram Nagar
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(5),
      status: "rejected",
      rejectionReason: "Contaminated with wet organic food waste. Non-recyclable condition upon driver inspection.",
      createdAt: daysAgo(6),
    },
    // Pickup 13: Rejected - Hazardous chemical container detected
    {
      userIndex: 7, // Pooja Patil
      wasteType: "PLASTIC",
      quantityBand: "SMALL",
      location: SANGLI_LOCATIONS[13], // Gaon Bhag
      slotPeriod: "MORNING",
      requestedDate: daysAgo(12),
      status: "rejected",
      rejectionReason: "Contains hazardous solvent containers not accepted in standard recyclable pickup.",
      createdAt: daysAgo(13),
    },

    // --- [F] Completed Pickups with Points & Ledger Entries (Populates Analytics) ---
    // Priya Sharma (Gold Tier - 350 pts total)
    {
      userIndex: 1, // Priya
      wasteType: "E_WASTE",
      quantityBand: "LARGE",
      wasteQuantity: 11.5,
      location: SANGLI_LOCATIONS[1],
      slotPeriod: "MORNING",
      requestedDate: daysAgo(15),
      status: "completed",
      vehicleIndex: 0,
      collectorIndex: 0,
      createdAt: daysAgo(16),
      completedAt: daysAgo(15),
    },
    {
      userIndex: 1, // Priya
      wasteType: "PLASTIC",
      quantityBand: "LARGE",
      wasteQuantity: 9.8,
      location: SANGLI_LOCATIONS[2],
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(35),
      status: "completed",
      vehicleIndex: 1,
      collectorIndex: 1,
      createdAt: daysAgo(36),
      completedAt: daysAgo(35),
    },
    {
      userIndex: 1, // Priya
      wasteType: "METAL",
      quantityBand: "LARGE",
      wasteQuantity: 8.2,
      location: SANGLI_LOCATIONS[3],
      slotPeriod: "EVENING",
      requestedDate: daysAgo(55),
      status: "completed",
      vehicleIndex: 2,
      collectorIndex: 2,
      createdAt: daysAgo(56),
      completedAt: daysAgo(55),
    },
    {
      userIndex: 1, // Priya
      wasteType: "GLASS",
      quantityBand: "LARGE",
      wasteQuantity: 12.0,
      location: SANGLI_LOCATIONS[4],
      slotPeriod: "MORNING",
      requestedDate: daysAgo(75),
      status: "completed",
      vehicleIndex: 3,
      collectorIndex: 3,
      createdAt: daysAgo(76),
      completedAt: daysAgo(75),
    },
    {
      userIndex: 1, // Priya
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "LARGE",
      wasteQuantity: 14.5,
      location: SANGLI_LOCATIONS[5],
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(85),
      status: "completed",
      vehicleIndex: 4,
      collectorIndex: 4,
      createdAt: daysAgo(86),
      completedAt: daysAgo(85),
    },
    {
      userIndex: 1, // Priya
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "LARGE",
      wasteQuantity: 10.2,
      location: SANGLI_LOCATIONS[6],
      slotPeriod: "MORNING",
      requestedDate: daysAgo(95),
      status: "completed",
      vehicleIndex: 0,
      collectorIndex: 0,
      createdAt: daysAgo(96),
      completedAt: daysAgo(95),
    },
    {
      userIndex: 1, // Priya (50 pts -> 6 * 50 + 50 = 350 pts)
      wasteType: "PLASTIC",
      quantityBand: "LARGE",
      wasteQuantity: 7.4,
      location: SANGLI_LOCATIONS[7],
      slotPeriod: "EVENING",
      requestedDate: daysAgo(105),
      status: "completed",
      vehicleIndex: 1,
      collectorIndex: 1,
      createdAt: daysAgo(106),
      completedAt: daysAgo(105),
    },

    // Rohan Deshmukh (Silver Tier - 175 pts total)
    {
      userIndex: 2, // Rohan
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "LARGE",
      wasteQuantity: 8.5,
      location: SANGLI_LOCATIONS[8],
      slotPeriod: "MORNING",
      requestedDate: daysAgo(10),
      status: "completed",
      vehicleIndex: 2,
      collectorIndex: 2,
      createdAt: daysAgo(11),
      completedAt: daysAgo(10),
    },
    {
      userIndex: 2, // Rohan
      wasteType: "PLASTIC",
      quantityBand: "LARGE",
      wasteQuantity: 6.8,
      location: SANGLI_LOCATIONS[9],
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(28),
      status: "completed",
      vehicleIndex: 3,
      collectorIndex: 3,
      createdAt: daysAgo(29),
      completedAt: daysAgo(28),
    },
    {
      userIndex: 2, // Rohan
      wasteType: "METAL",
      quantityBand: "LARGE",
      wasteQuantity: 7.2,
      location: SANGLI_LOCATIONS[10],
      slotPeriod: "EVENING",
      requestedDate: daysAgo(45),
      status: "completed",
      vehicleIndex: 4,
      collectorIndex: 4,
      createdAt: daysAgo(46),
      completedAt: daysAgo(45),
    },
    {
      userIndex: 2, // Rohan (25 pts -> 3 * 50 + 25 = 175 pts)
      wasteType: "GLASS",
      quantityBand: "MEDIUM",
      wasteQuantity: 3.5,
      location: SANGLI_LOCATIONS[11],
      slotPeriod: "MORNING",
      requestedDate: daysAgo(60),
      status: "completed",
      vehicleIndex: 0,
      collectorIndex: 0,
      createdAt: daysAgo(61),
      completedAt: daysAgo(60),
    },

    // Ananya Joshi (Bronze Tier - 75 pts total)
    {
      userIndex: 3, // Ananya
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "LARGE",
      wasteQuantity: 6.2,
      location: SANGLI_LOCATIONS[12],
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(18),
      status: "completed",
      vehicleIndex: 1,
      collectorIndex: 1,
      createdAt: daysAgo(19),
      completedAt: daysAgo(18),
    },
    {
      userIndex: 3, // Ananya (25 pts -> 50 + 25 = 75 pts)
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "MEDIUM",
      wasteQuantity: 3.1,
      location: SANGLI_LOCATIONS[13],
      slotPeriod: "MORNING",
      requestedDate: daysAgo(40),
      status: "completed",
      vehicleIndex: 2,
      collectorIndex: 2,
      createdAt: daysAgo(41),
      completedAt: daysAgo(40),
    },

    // Vikram More (Bronze Tier - 60 pts total)
    {
      userIndex: 4, // Vikram
      wasteType: "METAL",
      quantityBand: "LARGE",
      wasteQuantity: 7.0,
      location: SANGLI_LOCATIONS[1],
      slotPeriod: "EVENING",
      requestedDate: daysAgo(22),
      status: "completed",
      vehicleIndex: 3,
      collectorIndex: 3,
      createdAt: daysAgo(23),
      completedAt: daysAgo(22),
    },
    {
      userIndex: 4, // Vikram (10 pts -> 50 + 10 = 60 pts)
      wasteType: "GLASS",
      quantityBand: "SMALL",
      wasteQuantity: 1.5,
      location: SANGLI_LOCATIONS[2],
      slotPeriod: "MORNING",
      requestedDate: daysAgo(50),
      status: "completed",
      vehicleIndex: 4,
      collectorIndex: 4,
      createdAt: daysAgo(51),
      completedAt: daysAgo(50),
    },

    // Neha Kulkarni (25 pts)
    {
      userIndex: 5, // Neha
      wasteType: "PLASTIC",
      quantityBand: "MEDIUM",
      wasteQuantity: 3.4,
      location: SANGLI_LOCATIONS[3],
      slotPeriod: "AFTERNOON",
      requestedDate: daysAgo(14),
      status: "completed",
      vehicleIndex: 0,
      collectorIndex: 0,
      createdAt: daysAgo(15),
      completedAt: daysAgo(14),
    },
  ];

  let primaryDemoPickupId = null;
  const createdPickups = [];

  for (let i = 0; i < pickupsToCreate.length; i++) {
    const pDef = pickupsToCreate[i];
    const citizen = citizens[pDef.userIndex];
    const vehicle = pDef.vehicleIndex !== undefined ? vehicles[pDef.vehicleIndex] : null;
    const collector = pDef.collectorIndex !== undefined ? collectors[pDef.collectorIndex] : null;

    const pickup = await prisma.pickup.create({
      data: {
        userId: citizen.id,
        wasteType: pDef.wasteType,
        quantityBand: pDef.quantityBand,
        wasteQuantity: pDef.wasteQuantity || null,
        address: pDef.location.address,
        latitude: pDef.location.lat,
        longitude: pDef.location.lng,
        slotPeriod: pDef.slotPeriod,
        requestedDate: pDef.requestedDate,
        status: pDef.status,
        rejectionReason: pDef.rejectionReason || null,
        assignedAdminId: collector ? collector.id : null,
        assignedAt: vehicle ? (pDef.createdAt || now) : null,
        createdAt: pDef.createdAt || now,
        updatedAt: pDef.completedAt || pDef.startedAt || now,
      },
    });

    createdPickups.push(pickup);

    if (i === 0) {
      primaryDemoPickupId = pickup.id;
    }

    // Create PickupAssignment record if vehicle is assigned
    if (vehicle) {
      const isTerminal = ["completed", "cancelled", "rejected"].includes(pDef.status);
      await prisma.pickupAssignment.create({
        data: {
          pickupId: pickup.id,
          vehicleId: vehicle.id,
          assignedById: admin.id,
          assignedAt: pDef.createdAt || now,
          startedAt: pDef.startedAt || (pDef.status === "completed" ? pDef.completedAt : null),
          arrivedAt: pDef.arrivedAt || (pDef.status === "completed" ? pDef.completedAt : null),
          completedAt: pDef.completedAt || null,
          unassignedAt: isTerminal && pDef.status !== "completed" ? now : null,
          isActive: !isTerminal,
        },
      });
    }

    // If completed, award points and create pointsLedger record
    if (pDef.status === "completed") {
      const points = pointsForQuantityBand(pDef.quantityBand);
      await prisma.pointsLedger.create({
        data: {
          pickupId: pickup.id,
          userId: citizen.id,
          pointsEarned: points,
          createdAt: pDef.completedAt || now,
        },
      });
    }
  }

  console.log(`✓ Seeded ${createdPickups.length} demo pickups with full lifecycle coverage.`);

  // 8. Gamification Badges & Redemptions
  // Priya Sharma: 350 pts -> Gold, Silver, Bronze badges
  const priyaUser = citizens[1];
  const priyaBadges = ["Bronze", "Silver", "Gold"]
    .map((name) => badgeMap.get(name))
    .filter(Boolean);

  for (const b of priyaBadges) {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: priyaUser.id, badgeId: b.id } },
      update: {},
      create: { userId: priyaUser.id, badgeId: b.id, earnedAt: daysAgo(30) },
    });
  }

  // Rohan Deshmukh: 175 pts -> Silver, Bronze badges
  const rohanUser = citizens[2];
  const rohanBadges = ["Bronze", "Silver"]
    .map((name) => badgeMap.get(name))
    .filter(Boolean);

  for (const b of rohanBadges) {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: rohanUser.id, badgeId: b.id } },
      update: {},
      create: { userId: rohanUser.id, badgeId: b.id, earnedAt: daysAgo(20) },
    });
  }

  // Ananya Joshi: 75 pts -> Bronze badge
  const ananyaUser = citizens[3];
  const bronzeBadge = badgeMap.get("Bronze");
  if (bronzeBadge) {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: ananyaUser.id, badgeId: bronzeBadge.id } },
      update: {},
      create: { userId: ananyaUser.id, badgeId: bronzeBadge.id, earnedAt: daysAgo(15) },
    });
  }

  // Seed Reward Redemptions for Priya and Rohan
  // Priya: Redeemed Eco-Store Voucher (150 pts) & Plant Sapling (30 pts) -> 180 spent, 170 available
  const ecoVoucher = rewardMap.get("Eco-Store Voucher (Rs. 100)");
  const plantSapling = rewardMap.get("Plant Sapling");
  const toteBag = rewardMap.get("Reusable Tote Bag");

  if (ecoVoucher) {
    await prisma.rewardRedemption.create({
      data: {
        userId: priyaUser.id,
        rewardId: ecoVoucher.id,
        pointsSpent: ecoVoucher.pointsRequired,
        redemptionCode: "WW-RED-78210-ECO",
        redeemedAt: daysAgo(12),
      },
    });
  }
  if (plantSapling) {
    await prisma.rewardRedemption.create({
      data: {
        userId: priyaUser.id,
        rewardId: plantSapling.id,
        pointsSpent: plantSapling.pointsRequired,
        redemptionCode: "WW-RED-99432-SAP",
        redeemedAt: daysAgo(5),
      },
    });
  }

  // Rohan: Redeemed Reusable Tote Bag (50 pts) -> 50 spent, 125 available
  if (toteBag) {
    await prisma.rewardRedemption.create({
      data: {
        userId: rohanUser.id,
        rewardId: toteBag.id,
        pointsSpent: toteBag.pointsRequired,
        redemptionCode: "WW-RED-44219-BAG",
        redeemedAt: daysAgo(8),
      },
    });
  }
  console.log("✓ Seeded badges and reward redemptions with consistent ledger balances.");

  // 9. Output clear Summary
  console.log("\n================================================================================");
  console.log("🚛 [SIMULATED DEMO] Expanded WasteWise Demo Environment Ready!");
  console.log("================================================================================");
  console.log(`📌 Primary Live Demo Pickup ID: ${primaryDemoPickupId}`);
  console.log("👥 Demo Citizens Created:       14 accounts");
  console.log("🚚 Demo Fleet Vehicles Created:  6 vehicles (DEMO-TRUCK-01 to DEMO-TRUCK-06)");
  console.log("📦 Total Demo Pickups Seeded:   26 pickups across all 6 waste categories");
  console.log("   - Active In-Transit (Live):  2 (DEMO-TRUCK-01 on Station Rd, DEMO-TRUCK-02 on Shivaji Nagar)");
  console.log("   - Arrived at Destination:    1 (DEMO-TRUCK-03 on Brahman Puri)");
  console.log("   - Assigned / Queued:         2 (DEMO-TRUCK-04, DEMO-TRUCK-05)");
  console.log("   - Requested (Unassigned):    4 (E-Waste, Glass, Plastic, Paper)");
  console.log("   - Cancelled / Rejected:      4 (with detailed audit reasons)");
  console.log("   - Completed:                 13 (historical points ledger entries & analytics data)");
  console.log("\n👤 Demo Login Credentials (all passwords: see below):");
  console.log("   Admin:     admin@wastewise.local (or demo_admin@example.com / Admin@123)");
  console.log(`   Citizen:   demo_citizen@example.com / ${CITIZEN_PASSWORD} (Primary Live Citizen)`);
  console.log(`   Citizen:   demo_citizen_priya@example.com / ${CITIZEN_PASSWORD} (Gold Tier: 350 pts, Redemptions)`);
  console.log(`   Citizen:   demo_citizen_rohan@example.com / ${CITIZEN_PASSWORD} (Silver Tier: 175 pts)`);
  console.log(`   Collector: demo_collector@example.com / ${COLLECTOR_PASSWORD} (Driver of DEMO-TRUCK-01)`);
  console.log(`   Collector: demo_collector_suresh@example.com / ${COLLECTOR_PASSWORD} (Driver of DEMO-TRUCK-02)`);
  console.log("\n🚀 Live Simulation Commands:");
  console.log(`   Single Truck: npm run demo:drive -- --pickup=${primaryDemoPickupId} --speed=2 --auto-arrive`);
  console.log("   Multi Truck:  npm run demo:drive -- --multi --speed=2");
  console.log("================================================================================\n");
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
