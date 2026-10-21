require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./client");
const { BADGES, STARTER_REWARDS } = require("../config/constants");

// Demo city coordinates: Miraj / Sangli, Maharashtra
const DEMO_CITY = {
  name: "Miraj",
  hub: {
    lat: 16.8580,
    lng: 74.6150,
    address: "Central Sorting & Recycling Hub, MIDC Miraj, Maharashtra 416410",
  },
  samplePickup: {
    lat: 16.8413,
    lng: 74.6016,
    address: "Station Road, Near Miraj Junction, Miraj, Maharashtra 416410",
  },
};

// Realistic locations in the local operating zone
const LOCAL_ADDRESSES = [
  { address: "Station Road, Near Miraj Junction, Miraj, Maharashtra 416410", lat: 16.8413, lng: 74.6016 },
  { address: "Brahman Puri, Near Venkatesh Mandir, Miraj 416410", lat: 16.8435, lng: 74.6080 },
  { address: "Market Yard Road, Near APMC Market, Miraj 416410", lat: 16.8520, lng: 74.6120 },
  { address: "Gandhi Chowk, High School Road, Miraj 416410", lat: 16.8460, lng: 74.6045 },
  { address: "Wanless Hospital Road, Mission Compound, Miraj 416410", lat: 16.8390, lng: 74.6190 },
  { address: "Shivaji Nagar, Opp. City Garden, Miraj 416410", lat: 16.8475, lng: 74.6155 },
  { address: "Vishrambag Main Road, Sangli-Miraj Link, Sangli 416415", lat: 16.8510, lng: 74.5880 },
  { address: "Kupwad MIDC Phase 1, Near Water Tank, Miraj 416436", lat: 16.8620, lng: 74.6280 },
  { address: "Chandanwadi, Behind Civil Hospital, Miraj 416410", lat: 16.8350, lng: 74.6095 },
  { address: "Madhavnagar Road, Near Railway Crossing, Miraj 416410", lat: 16.8605, lng: 74.6030 },
];

const CITIZEN_PROFILES = [
  { name: "Aarav Mehta", email: "citizen@wastewise.local", phone: "+919820998877" },
  { name: "Priya Sharma", email: "priya.sharma@example.com", phone: "+919820114455" },
  { name: "Rohan Deshmukh", email: "rohan.deshmukh@example.com", phone: "+919820223344" },
  { name: "Ananya Joshi", email: "ananya.joshi@example.com", phone: "+919820335566" },
  { name: "Vikram More", email: "vikram.more@example.com", phone: "+919820446677" },
  { name: "Neha Kulkarni", email: "neha.kulkarni@example.com", phone: "+919820557788" },
  { name: "Aditya Shinde", email: "aditya.shinde@example.com", phone: "+919820668899" },
  { name: "Pooja Patil", email: "pooja.patil@example.com", phone: "+919820779900" },
  { name: "Sameer Kadam", email: "sameer.kadam@example.com", phone: "+919820880011" },
  { name: "Kavita Gaikwad", email: "kavita.gaikwad@example.com", phone: "+919820991122" },
  { name: "Rahul Bhosale", email: "rahul.bhosale@example.com", phone: "+919820123456" },
  { name: "Sneha Chavan", email: "sneha.chavan@example.com", phone: "+919820654321" },
];

const COLLECTOR_PROFILES = [
  { name: "Ramesh Shinde", email: "driver@wastewise.local", phone: "+919820112233" },
  { name: "Suresh Patil", email: "suresh.patil@wastewise.local", phone: "+919820224466" },
  { name: "Vikas Jadhav", email: "vikas.jadhav@wastewise.local", phone: "+919820336699" },
  { name: "Sachin Kamble", email: "sachin.kamble@wastewise.local", phone: "+919820448811" },
];

const VEHICLE_PROFILES = [
  {
    registrationNo: "MH-02-WW-1001",
    type: "Electric Mini Van",
    capacity: 500,
    collectorIndex: 0,
    lat: 16.8580,
    lng: 74.6150,
    speed: 18,
    heading: 90,
  },
  {
    registrationNo: "MH-02-WW-2002",
    type: "Tata Ace Recycler",
    capacity: 750,
    collectorIndex: 1,
    lat: 16.8480,
    lng: 74.5980,
    speed: 14,
    heading: 180,
  },
  {
    registrationNo: "MH-02-WW-3003",
    type: "Mahindra Bolero Maxi",
    capacity: 1000,
    collectorIndex: 2,
    lat: 16.8420,
    lng: 74.6100,
    speed: 22,
    heading: 270,
  },
  {
    registrationNo: "MH-02-WW-4004",
    type: "Piaggio Ape E-City",
    capacity: 350,
    collectorIndex: 3,
    lat: 16.8520,
    lng: 74.6050,
    speed: 0,
    heading: 0,
  },
];

const WASTE_CATEGORIES = [
  "PAPER_CARDBOARD",
  "PLASTIC",
  "METAL",
  "GLASS",
  "E_WASTE",
  "MIXED_RECYCLABLES",
];

const QUANTITY_BANDS = [
  { band: "SMALL", kgRange: [1.2, 2.0], points: 15 },
  { band: "MEDIUM", kgRange: [2.5, 4.8], points: 35 },
  { band: "LARGE", kgRange: [5.5, 12.0], points: 70 },
];

const SLOT_PERIODS = ["MORNING", "AFTERNOON", "EVENING"];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min, max, decimals = 1) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_SEED) {
    throw new Error(
      "SECURITY ALERT: Seeding is blocked in production. Set ALLOW_PROD_SEED=true to force."
    );
  }

  console.log("🌱 Starting WasteWise comprehensive seed generation...");

  // 1. Seed Badges
  const createdBadges = [];
  for (const badge of BADGES) {
    const b = await prisma.badge.upsert({
      where: { name: badge.name },
      update: { minPoints: badge.minPoints, description: badge.description },
      create: badge,
    });
    createdBadges.push(b);
  }
  console.log(`✓ Seeded ${createdBadges.length} milestone badges.`);

  // 2. Seed Starter Rewards
  const createdRewards = [];
  for (const reward of STARTER_REWARDS) {
    const existing = await prisma.reward.findFirst({ where: { name: reward.name } });
    if (existing) {
      const updated = await prisma.reward.update({
        where: { id: existing.id },
        data: {
          pointsRequired: reward.pointsRequired,
          stock: reward.stock,
          description: reward.description,
        },
      });
      createdRewards.push(updated);
    } else {
      const created = await prisma.reward.create({ data: reward });
      createdRewards.push(created);
    }
  }
  console.log(`✓ Upserted ${createdRewards.length} starter rewards.`);

  // 3. Admin Account
  const adminEmail = "admin@wastewise.local";
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "admin", name: "Pruthvi ZeroWaste Admin" },
    create: {
      name: "Pruthvi ZeroWaste Admin",
      email: adminEmail,
      phone: "+919820000001",
      passwordHash: adminPasswordHash,
      role: "admin",
    },
  });
  console.log(`✓ Admin account ready: ${adminEmail}`);

  // 4. Collector Accounts
  const collectors = [];
  const collectorPasswordHash = await bcrypt.hash("Driver@123", 10);
  for (const c of COLLECTOR_PROFILES) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { role: "collector", name: c.name, phone: c.phone },
      create: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        passwordHash: collectorPasswordHash,
        role: "collector",
      },
    });
    collectors.push(user);
  }
  console.log(`✓ Upserted ${collectors.length} fleet collectors.`);

  // 5. Citizen Accounts
  const citizens = [];
  const citizenPasswordHash = await bcrypt.hash("Citizen@123", 10);
  for (let i = 0; i < CITIZEN_PROFILES.length; i++) {
    const cp = CITIZEN_PROFILES[i];
    // Stagger creation dates across the past 60 days
    const daysAgo = Math.floor(Math.random() * 45) + 10;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const user = await prisma.user.upsert({
      where: { email: cp.email },
      update: { role: "citizen", name: cp.name, phone: cp.phone },
      create: {
        name: cp.name,
        email: cp.email,
        phone: cp.phone,
        passwordHash: citizenPasswordHash,
        role: "citizen",
        createdAt,
      },
    });
    citizens.push(user);
  }
  console.log(`✓ Upserted ${citizens.length} registered citizens.`);

  // 6. Fleet Vehicles
  const vehicles = [];
  for (const vp of VEHICLE_PROFILES) {
    const driver = collectors[vp.collectorIndex];
    const veh = await prisma.vehicle.upsert({
      where: { registrationNo: vp.registrationNo },
      update: {
        driverId: driver ? driver.id : null,
        type: vp.type,
        capacity: vp.capacity,
        isActive: true,
        currentLat: vp.lat,
        currentLng: vp.lng,
        currentSpeed: vp.speed,
        currentHeading: vp.heading,
        lastLocationAt: new Date(),
      },
      create: {
        registrationNo: vp.registrationNo,
        type: vp.type,
        capacity: vp.capacity,
        driverId: driver ? driver.id : null,
        isActive: true,
        currentLat: vp.lat,
        currentLng: vp.lng,
        currentSpeed: vp.speed,
        currentHeading: vp.heading,
        lastLocationAt: new Date(),
      },
    });
    vehicles.push(veh);
  }
  console.log(`✓ Upserted ${vehicles.length} fleet vehicles.`);

  // 7. Clean existing demo pickups to prevent duplicates and build a pristine timeline
  await prisma.pickupAssignment.deleteMany();
  await prisma.pointsLedger.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.vehicleLocation.deleteMany();
  await prisma.pickup.deleteMany();
  console.log("✓ Cleared prior temporary pickup/activity records.");

  // 8. Generate 34 Completed Pickups over the past 30 days
  // Generating a smooth, realistic daily distribution so 30-day Recharts area graphs look vibrant
  const completedPickups = [];
  const citizenPointsMap = {};
  citizens.forEach((c) => (citizenPointsMap[c.id] = 0));

  for (let dayOffset = 29; dayOffset >= 1; dayOffset--) {
    // 1 to 2 completions per day
    const countToday = Math.random() < 0.4 ? 2 : 1;
    for (let c = 0; c < countToday; c++) {
      const citizen = randomChoice(citizens);
      const loc = randomChoice(LOCAL_ADDRESSES);
      const category = randomChoice(WASTE_CATEGORIES);
      const qBand = randomChoice(QUANTITY_BANDS);
      const weight = randomFloat(qBand.kgRange[0], qBand.kgRange[1], 1);
      const assignedCollector = randomChoice(collectors.slice(0, 3));
      const assignedVehicle = vehicles[collectors.indexOf(assignedCollector)] || vehicles[0];

      const pickupDate = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
      const completedDate = new Date(pickupDate.getTime() + (2 + Math.random() * 4) * 60 * 60 * 1000);

      const pickup = await prisma.pickup.create({
        data: {
          userId: citizen.id,
          wasteType: category,
          quantityBand: qBand.band,
          wasteQuantity: weight,
          address: loc.address,
          latitude: loc.lat + randomFloat(-0.003, 0.003, 5),
          longitude: loc.lng + randomFloat(-0.003, 0.003, 5),
          slotPeriod: randomChoice(SLOT_PERIODS),
          requestedDate: pickupDate,
          status: "completed",
          assignedAdminId: assignedCollector.id,
          assignedAt: pickupDate,
          createdAt: pickupDate,
          updatedAt: completedDate,
        },
      });

      // Points ledger entry
      await prisma.pointsLedger.create({
        data: {
          pickupId: pickup.id,
          userId: citizen.id,
          pointsEarned: qBand.points,
          createdAt: completedDate,
        },
      });

      // Historical vehicle assignment
      await prisma.pickupAssignment.create({
        data: {
          pickupId: pickup.id,
          vehicleId: assignedVehicle.id,
          assignedById: admin.id,
          assignedAt: pickupDate,
          startedAt: new Date(pickupDate.getTime() + 30 * 60 * 1000),
          arrivedAt: new Date(pickupDate.getTime() + 60 * 60 * 1000),
          completedAt: completedDate,
          isActive: false,
        },
      });

      citizenPointsMap[citizen.id] += qBand.points;
      completedPickups.push(pickup);
    }
  }
  console.log(`✓ Seeded ${completedPickups.length} completed historical pickups with points ledger & telemetry.`);

  // 9. Seed 4 Currently Active / Assigned Pickups (with Live Tracking)
  const activePickupConfigs = [
    {
      citizenIndex: 0,
      vehicleIndex: 0,
      collectorIndex: 0,
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "MEDIUM",
      weight: 4.5,
      loc: DEMO_CITY.samplePickup,
      slotPeriod: "MORNING",
    },
    {
      citizenIndex: 1,
      vehicleIndex: 1,
      collectorIndex: 1,
      wasteType: "PLASTIC",
      quantityBand: "LARGE",
      weight: 8.2,
      loc: LOCAL_ADDRESSES[2],
      slotPeriod: "AFTERNOON",
    },
    {
      citizenIndex: 2,
      vehicleIndex: 2,
      collectorIndex: 2,
      wasteType: "E_WASTE",
      quantityBand: "SMALL",
      weight: 2.1,
      loc: LOCAL_ADDRESSES[4],
      slotPeriod: "MORNING",
    },
    {
      citizenIndex: 3,
      vehicleIndex: 0,
      collectorIndex: 0,
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "MEDIUM",
      weight: 3.8,
      loc: LOCAL_ADDRESSES[1],
      slotPeriod: "AFTERNOON",
    },
  ];

  for (const ap of activePickupConfigs) {
    const citizen = citizens[ap.citizenIndex];
    const vehicle = vehicles[ap.vehicleIndex];
    const collector = collectors[ap.collectorIndex];

    const pickup = await prisma.pickup.create({
      data: {
        userId: citizen.id,
        wasteType: ap.wasteType,
        quantityBand: ap.quantityBand,
        wasteQuantity: ap.weight,
        address: ap.loc.address,
        latitude: ap.loc.lat,
        longitude: ap.loc.lng,
        slotPeriod: ap.slotPeriod,
        requestedDate: new Date(),
        status: "assigned",
        assignedAdminId: collector.id,
        assignedAt: new Date(Date.now() - 45 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });

    await prisma.pickupAssignment.create({
      data: {
        pickupId: pickup.id,
        vehicleId: vehicle.id,
        assignedById: admin.id,
        assignedAt: new Date(Date.now() - 45 * 60 * 1000),
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
        isActive: true,
      },
    });
  }
  console.log(`✓ Seeded ${activePickupConfigs.length} active assigned pickups with live fleet links.`);

  // 10. Seed 6 Requested (Pending) Pickups in the Queue
  const pendingRequests = [
    { citizenIndex: 4, wasteType: "PLASTIC", quantityBand: "MEDIUM", weight: 3.5, locIndex: 3, slot: "AFTERNOON" },
    { citizenIndex: 5, wasteType: "PAPER_CARDBOARD", quantityBand: "LARGE", weight: 9.0, locIndex: 5, slot: "MORNING" },
    { citizenIndex: 6, wasteType: "E_WASTE", quantityBand: "SMALL", weight: 1.8, locIndex: 6, slot: "EVENING" },
    { citizenIndex: 7, wasteType: "GLASS", quantityBand: "MEDIUM", weight: 4.2, locIndex: 7, slot: "AFTERNOON" },
    { citizenIndex: 8, wasteType: "METAL", quantityBand: "LARGE", weight: 7.5, locIndex: 8, slot: "MORNING" },
    { citizenIndex: 9, wasteType: "MIXED_RECYCLABLES", quantityBand: "SMALL", weight: 2.0, locIndex: 9, slot: "EVENING" },
  ];

  for (let i = 0; i < pendingRequests.length; i++) {
    const pr = pendingRequests[i];
    const citizen = citizens[pr.citizenIndex];
    const loc = LOCAL_ADDRESSES[pr.locIndex];
    const requestedDate = new Date(Date.now() + (i % 2 === 0 ? 0 : 24 * 60 * 60 * 1000));

    await prisma.pickup.create({
      data: {
        userId: citizen.id,
        wasteType: pr.wasteType,
        quantityBand: pr.quantityBand,
        wasteQuantity: pr.weight,
        address: loc.address,
        latitude: loc.lat,
        longitude: loc.lng,
        slotPeriod: pr.slot,
        requestedDate,
        status: "requested",
        createdAt: new Date(Date.now() - (i + 1) * 35 * 60 * 1000),
      },
    });
  }
  console.log(`✓ Seeded ${pendingRequests.length} pending pickup requests in the admin operational queue.`);

  // 11. Seed a couple of Cancelled & Rejected Pickups for complete status distribution
  await prisma.pickup.create({
    data: {
      userId: citizens[10].id,
      wasteType: "MIXED_RECYCLABLES",
      quantityBand: "SMALL",
      wasteQuantity: 1.5,
      address: LOCAL_ADDRESSES[0].address,
      latitude: LOCAL_ADDRESSES[0].lat,
      longitude: LOCAL_ADDRESSES[0].lng,
      slotPeriod: "MORNING",
      requestedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: "cancelled",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.pickup.create({
    data: {
      userId: citizens[11].id,
      wasteType: "E_WASTE",
      quantityBand: "LARGE",
      wasteQuantity: 14.0,
      address: LOCAL_ADDRESSES[2].address,
      latitude: LOCAL_ADDRESSES[2].lat,
      longitude: LOCAL_ADDRESSES[2].lng,
      slotPeriod: "AFTERNOON",
      requestedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: "rejected",
      rejectionReason: "Commercial volume exceeding residential pickup threshold. Directed to industrial depot.",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("✓ Seeded sample cancelled & rejected requests for realistic distribution.");

  // 12. Award Milestone Badges to citizens based on their accumulated points
  const bronzeBadge = createdBadges.find((b) => b.name === "Bronze");
  const silverBadge = createdBadges.find((b) => b.name === "Silver");
  const goldBadge = createdBadges.find((b) => b.name === "Gold");

  let badgeCount = 0;
  for (const citizen of citizens) {
    const pts = citizenPointsMap[citizen.id] || 0;
    if (bronzeBadge && pts >= bronzeBadge.minPoints) {
      await prisma.userBadge.create({
        data: {
          userId: citizen.id,
          badgeId: bronzeBadge.id,
          earnedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
      });
      badgeCount++;
    }
    if (silverBadge && pts >= silverBadge.minPoints) {
      await prisma.userBadge.create({
        data: {
          userId: citizen.id,
          badgeId: silverBadge.id,
          earnedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      });
      badgeCount++;
    }
    if (goldBadge && pts >= goldBadge.minPoints) {
      await prisma.userBadge.create({
        data: {
          userId: citizen.id,
          badgeId: goldBadge.id,
          earnedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      });
      badgeCount++;
    }
  }
  console.log(`✓ Awarded ${badgeCount} milestone badges to eligible citizens.`);

  // 13. Seed Reward Redemptions
  if (createdRewards.length >= 3) {
    const redemptions = [
      { citizen: citizens[0], reward: createdRewards[0], points: 50, code: "WW-TOTE-7841", daysAgo: 6 },
      { citizen: citizens[1], reward: createdRewards[1], points: 30, code: "WW-PLANT-9204", daysAgo: 12 },
      { citizen: citizens[2], reward: createdRewards[0], points: 50, code: "WW-TOTE-4190", daysAgo: 18 },
      { citizen: citizens[3], reward: createdRewards[2], points: 150, code: "WW-VOUCH-3319", daysAgo: 4 },
      { citizen: citizens[0], reward: createdRewards[1], points: 30, code: "WW-PLANT-5512", daysAgo: 2 },
      { citizen: citizens[4], reward: createdRewards[0], points: 50, code: "WW-TOTE-8821", daysAgo: 9 },
    ];

    for (const r of redemptions) {
      await prisma.rewardRedemption.create({
        data: {
          userId: r.citizen.id,
          rewardId: r.reward.id,
          pointsSpent: r.points,
          redemptionCode: r.code,
          redeemedAt: new Date(Date.now() - r.daysAgo * 24 * 60 * 60 * 1000),
        },
      });
    }
    console.log(`✓ Seeded ${redemptions.length} sample reward redemptions.`);
  }

  console.log("✨ WasteWise database successfully populated with rich, realistic operational data!");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
