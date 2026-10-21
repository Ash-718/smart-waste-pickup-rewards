const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:4000/api";

const testUserIds = [];
const testPickupIds = [];
const testRewardIds = [];
const testBadgeIds = [];

async function req(path, method = "GET", token = null, body = null) {
  const headers = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function cleanupQaData() {
  console.log("\n--- [TEARDOWN] Purging QA Test Fixtures ---");
  try {
    if (testPickupIds.length > 0 || testUserIds.length > 0) {
      await prisma.pointsLedger.deleteMany({
        where: {
          OR: [
            ...(testPickupIds.length > 0 ? [{ pickupId: { in: testPickupIds } }] : []),
            ...(testUserIds.length > 0 ? [{ userId: { in: testUserIds } }] : []),
          ],
        },
      });
      await prisma.userBadge.deleteMany({
        where: {
          OR: [
            ...(testBadgeIds.length > 0 ? [{ badgeId: { in: testBadgeIds } }] : []),
            ...(testUserIds.length > 0 ? [{ userId: { in: testUserIds } }] : []),
          ],
        },
      });
      await prisma.pickupAssignment.deleteMany({
        where: { pickupId: { in: testPickupIds } },
      });
      await prisma.pickup.deleteMany({
        where: { id: { in: testPickupIds } },
      });
    }

    if (testRewardIds.length > 0) {
      await prisma.reward.deleteMany({ where: { id: { in: testRewardIds } } });
    }
    if (testBadgeIds.length > 0) {
      await prisma.badge.deleteMany({ where: { id: { in: testBadgeIds } } });
    }
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
    console.log("✓ Teardown complete: All QA test fixtures cleanly purged.");
  } catch (err) {
    console.error("Warning during QA teardown:", err.message);
  }
}

async function runQa() {
  console.log("====================================================");
  console.log("   FULL END-TO-END DATA CONSISTENCY & QA PASS       ");
  console.log("====================================================");

  // 1. Admin login
  const adminLog = await req("/auth/login", "POST", null, {
    email: "admin@wastewise.local",
    password: "Admin@123",
  });
  if (!adminLog.ok) throw new Error("Admin login failed: " + JSON.stringify(adminLog.data));
  const adminToken = adminLog.data.token;
  console.log("✓ [1/15] Admin authenticated");

  // 2. Register fresh citizen
  const citizenEmail = `qa_citizen_${Date.now()}@pruthvi.ngo`;
  const citizenReg = await req("/auth/register", "POST", null, {
    name: "Ananya Sharma",
    email: citizenEmail,
    password: "Password@123",
    phone: "98" + Math.floor(10000000 + Math.random() * 90000000),
  });
  if (!citizenReg.ok) throw new Error("Citizen register failed: " + JSON.stringify(citizenReg.data));
  const citizenToken = citizenReg.data.token;
  const citizenId = citizenReg.data.user.id;
  testUserIds.push(citizenId);
  console.log(`✓ [2/15] Citizen registered: Ananya Sharma (${citizenEmail})`);

  // 3. Citizen books a pickup
  const bookRes = await req("/pickups", "POST", citizenToken, {
    wasteType: "PLASTIC",
    quantityBand: "MEDIUM",
    slotPeriod: "MORNING",
    address: "Flat 402, Green Meadows, Pune",
    requestedDate: new Date().toISOString(),
  });
  if (!bookRes.ok) throw new Error("Booking failed: " + JSON.stringify(bookRes.data));
  const pickup1 = bookRes.data.pickup;
  testPickupIds.push(pickup1.id);
  console.log(`✓ [3/15] Pickup #1 booked: ID ${pickup1.id} (Status: ${pickup1.status})`);

  // Verify DB state
  const dbPickup1 = await prisma.pickup.findUnique({ where: { id: pickup1.id } });
  if (dbPickup1.status !== "requested") throw new Error("DB status mismatch for pickup1");
  console.log(`✓ [4/15] DB verified: Pickup #1 in PostgreSQL with status=requested, wasteQuantity=${dbPickup1.wasteQuantity}`);

  // 4. Admin fetches collectors and assigns pickup #1 to collector with an active vehicle
  const colRes = await req("/admin/collectors", "GET", adminToken);
  const vehRes = await req("/admin/vehicles", "GET", adminToken);
  const activeVehicle = vehRes.data?.vehicles?.find(
    (v) => v.isActive && v.driverId && v.driver?.role === "collector"
  );
  const collector = activeVehicle ? activeVehicle.driver : colRes.data.collectors.find((c) => c.role === "collector");
  if (!collector) throw new Error("No eligible collector with assigned vehicle found");
  console.log(`✓ [5/15] Found collector: ${collector.name} (ID: ${collector.id})`);

  const assignRes = await req(`/pickups/${pickup1.id}/assign`, "PATCH", adminToken, {
    collectorId: collector.id,
    slotPeriod: "MORNING",
  });
  if (!assignRes.ok) throw new Error("Assign failed: " + JSON.stringify(assignRes.data));
  console.log(`✓ [6/15] Admin assigned Pickup #1 to ${collector.name}`);

  // Verify DB after assignment
  const dbAssigned = await prisma.pickup.findUnique({
    where: { id: pickup1.id },
    include: { assignedAdmin: true },
  });
  if (dbAssigned.status !== "assigned" || dbAssigned.assignedAdminId !== collector.id || !dbAssigned.assignedAt) {
    throw new Error("DB state not updated properly on assignment");
  }
  console.log(`✓ [7/15] DB verified: status=assigned, assignedAdminId=${collector.id}, assignedAt=${dbAssigned.assignedAt.toISOString()}`);

  // 5. Citizen views pickup details - sees collector info
  const citizenView1 = await req(`/pickups/${pickup1.id}`, "GET", citizenToken);
  if (citizenView1.data.pickup.assignedAdmin.name !== collector.name) {
    throw new Error("Citizen does not see collector name");
  }
  console.log(`✓ [8/15] Citizen verified: sees assigned collector "${citizenView1.data.pickup.assignedAdmin.name}"`);

  // 6. Test Rejection flow with mandatory reason
  const book2 = await req("/pickups", "POST", citizenToken, {
    wasteType: "E_WASTE",
    quantityBand: "LARGE",
    slotPeriod: "AFTERNOON",
    address: "Sector 5, Pune",
    requestedDate: new Date().toISOString(),
  });
  const pickup2 = book2.data.pickup;
  testPickupIds.push(pickup2.id);
  console.log(`✓ [9/15] Pickup #2 booked for rejection test (ID: ${pickup2.id})`);

  // Rejection without reason fails with 400
  const rejFail = await req(`/pickups/${pickup2.id}/status`, "PATCH", adminToken, { status: "rejected" });
  if (rejFail.status !== 400) throw new Error("Rejection without reason did not fail with 400");
  console.log("✓ [10/15] Validation passed: Rejection without reason correctly rejected (HTTP 400)");

  // Rejection with mandatory reason succeeds
  const rejOk = await req(`/pickups/${pickup2.id}/status`, "PATCH", adminToken, {
    status: "rejected",
    rejectionReason: "Contaminated electronic waste with chemical leak risk.",
  });
  if (!rejOk.ok) throw new Error("Rejection with reason failed");
  console.log(`✓ [11/15] Rejection succeeded with mandatory reason: "${rejOk.data.pickup.rejectionReason}"`);

  // 7. Complete Pickup #1 and award points
  const completeRes = await req(`/pickups/${pickup1.id}/status`, "PATCH", adminToken, {
    status: "completed",
    wasteQuantity: 5.8,
  });
  if (!completeRes.ok) throw new Error("Complete pickup failed: " + JSON.stringify(completeRes.data));
  console.log(`✓ [12/15] Pickup #1 completed! Points awarded: ${completeRes.data.pointsEarned}`);

  // Verify points ledger
  const pointsRes = await req("/points/balance", "GET", citizenToken);
  if (pointsRes.data.balance !== completeRes.data.pointsEarned) {
    throw new Error(`Points balance (${pointsRes.data.balance}) mismatch with earned (${completeRes.data.pointsEarned})`);
  }
  console.log(`✓ [13/15] Points ledger verified: Citizen balance = ${pointsRes.data.balance} Green Points`);

  // 8. Verify Citizen Impact & Admin User Profile match
  const citizenImpact = await req("/pickups/my-impact", "GET", citizenToken);
  const adminProfile = await req(`/admin/users/${citizenId}`, "GET", adminToken);
  if (citizenImpact.data.totalWasteContributed !== 5.8 || adminProfile.data.metrics.totalWasteKg !== 5.8) {
    throw new Error("Metrics mismatch between citizen and admin view");
  }
  console.log(`✓ [14/15] Impact consistency verified: Citizen sees ${citizenImpact.data.totalWasteContributed} kg, Admin sees ${adminProfile.data.metrics.totalWasteKg} kg`);

  // 9. Create New Reward, Badge, Collector
  const newReward = await req("/rewards", "POST", adminToken, {
    name: "Bamboo Toothbrush Pack QA " + Date.now(),
    pointsRequired: 80,
    stock: 50,
    description: "Eco-friendly biodegradable toothbrush kit",
  });
  if (!newReward.ok) throw new Error("Create reward failed: " + JSON.stringify(newReward.data));
  if (newReward.data.reward?.id) testRewardIds.push(newReward.data.reward.id);

  const newBadge = await req("/badges", "POST", adminToken, {
    name: "Eco Champion QA " + Date.now(),
    description: "Recycled over 100 kg of waste",
    minPoints: 100,
    iconUrl: "badge-champion",
  });
  if (!newBadge.ok) throw new Error("Create badge failed: " + JSON.stringify(newBadge.data));
  if (newBadge.data.badge?.id) testBadgeIds.push(newBadge.data.badge.id);

  const newCollector = await req("/admin/collectors", "POST", adminToken, {
    name: "Sunil Jadhav",
    phone: "99" + Math.floor(10000000 + Math.random() * 90000000),
    password: "Password@123",
  });
  if (!newCollector.ok) throw new Error("Create collector failed: " + JSON.stringify(newCollector.data));
  if (newCollector.data.collector?.id) testUserIds.push(newCollector.data.collector.id);
  console.log("✓ [15/15] Create New Reward, Badge, and Collector all succeeded and saved in PostgreSQL");

  console.log("\n====================================================");
  console.log("   ALL 15 END-TO-END QA TESTS PASSED WITH 100% SUCCESS");
  console.log("====================================================");
}

runQa()
  .catch((e) => {
    console.error("QA TEST FAILED:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupQaData();
    await prisma.$disconnect();
  });
