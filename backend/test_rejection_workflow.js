const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = "http://localhost:4000/api";

const testUserIds = [];
const testPickupIds = [];

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

async function cleanupTestData() {
  console.log("\n--- [TEARDOWN] Cleaning up test fixtures ---");
  try {
    if (testPickupIds.length > 0) {
      await prisma.pointsLedger.deleteMany({
        where: { pickupId: { in: testPickupIds } },
      });
      await prisma.pickupAssignment.deleteMany({
        where: { pickupId: { in: testPickupIds } },
      });
      await prisma.pickup.deleteMany({
        where: { id: { in: testPickupIds } },
      });
    }
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }
    console.log("✓ Teardown successful: All test fixtures removed.");
  } catch (err) {
    console.error("Warning during teardown:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function runRejectionWorkflowTests() {
  console.log("====================================================");
  console.log("   TESTING PICKUP REJECTION WORKFLOW & SECURITY     ");
  console.log("====================================================");

  try {
    // Step 1: Admin login
    const adminLog = await req("/auth/login", "POST", null, {
      email: "admin@wastewise.local",
      password: "Admin@123",
    });
    if (!adminLog.ok) throw new Error("Admin login failed: " + JSON.stringify(adminLog.data));
    const adminToken = adminLog.data.token;
    console.log("✓ [Step 1] Admin authenticated successfully.");

    // Step 2: Register test citizen
    const citizenEmail = `reject_test_${Date.now()}@test.pruthvi.ngo`;
    const citizenReg = await req("/auth/register", "POST", null, {
      name: "Rohit Deshmukh",
      email: citizenEmail,
      password: "Password@123",
      phone: "91" + Math.floor(10000000 + Math.random() * 90000000),
    });
    if (!citizenReg.ok) throw new Error("Citizen registration failed: " + JSON.stringify(citizenReg.data));
    const citizenToken = citizenReg.data.token;
    const citizenId = citizenReg.data.user.id;
    testUserIds.push(citizenId);
    console.log(`✓ [Step 2] Test citizen registered: Rohit Deshmukh (${citizenEmail})`);

    // Step 3: Citizen books a requested pickup
    const bookRes = await req("/pickups", "POST", citizenToken, {
      wasteType: "E_WASTE",
      quantityBand: "SMALL",
      slotPeriod: "MORNING",
      address: "B-204 Horizon Towers, Kothrud, Pune",
      requestedDate: new Date().toISOString(),
    });
    if (!bookRes.ok) throw new Error("Booking failed: " + JSON.stringify(bookRes.data));
    const pickup1Id = bookRes.data.pickup.id;
    testPickupIds.push(pickup1Id);
    console.log(`✓ [Step 3] Created test pickup (requested): ${pickup1Id}`);

    // Step 4: Security test - Citizen attempts to reject (Must return 403 Forbidden)
    const citizenReject = await req(`/pickups/${pickup1Id}/status`, "PATCH", citizenToken, {
      status: "rejected",
      rejectionReason: "Citizen trying to reject unauthorized",
    });
    if (citizenReject.status === 403) {
      console.log("✓ [Step 4] Authorization enforced: Non-admin citizen rejected with HTTP 403.");
    } else {
      throw new Error(`Expected HTTP 403 for citizen rejection, got ${citizenReject.status}: ${JSON.stringify(citizenReject.data)}`);
    }

    // Step 5: Admin rejects requested pickup with specific reason
    const customReason = "Submitted photos show mixed hazardous and contaminated medical electronic waste.";
    const adminRejectRes = await req(`/pickups/${pickup1Id}/status`, "PATCH", adminToken, {
      status: "rejected",
      rejectionReason: customReason,
    });
    if (!adminRejectRes.ok) {
      throw new Error(`Admin rejection failed: ${JSON.stringify(adminRejectRes.data)}`);
    }
    console.log("✓ [Step 5] Admin rejected pickup via PATCH /api/pickups/:id/status successfully.");

    // Step 6: Verify database state
    const dbPickup = await prisma.pickup.findUnique({
      where: { id: pickup1Id },
    });
    if (dbPickup.status !== "rejected") {
      throw new Error(`Expected status 'rejected', found '${dbPickup.status}'`);
    }
    if (dbPickup.rejectionReason !== customReason) {
      throw new Error(`Expected reason '${customReason}', found '${dbPickup.rejectionReason}'`);
    }
    console.log(`✓ [Step 6] Database persistence verified: Status = '${dbPickup.status}', Reason = '${dbPickup.rejectionReason}'`);

    // Step 7: Verify filter ?status=rejected returns this pickup
    const listRejected = await req("/pickups?status=rejected", "GET", adminToken);
    if (!listRejected.ok) throw new Error("Failed to list rejected pickups");
    const foundInList = listRejected.data.pickups.some((p) => p.id === pickup1Id);
    if (!foundInList) {
      throw new Error("Rejected pickup was not found in filtered list (?status=rejected)");
    }
    console.log("✓ [Step 7] Rejection filter verified: Pickup accurately returned in ?status=rejected query.");

    // Step 8: Terminal state enforcement - Cannot transition rejected pickup to on_the_way or completed
    const illegalTransition = await req(`/pickups/${pickup1Id}/status`, "PATCH", adminToken, {
      status: "on_the_way",
    });
    if (illegalTransition.status === 400) {
      console.log("✓ [Step 8] State transition machine: Cannot transition from 'rejected' terminal state (HTTP 400).");
    } else {
      throw new Error(`Expected HTTP 400 for illegal transition from rejected, got ${illegalTransition.status}`);
    }

    // Step 9: Test rejection with dedicated /reject endpoint and optional default reason
    const bookRes2 = await req("/pickups", "POST", citizenToken, {
      wasteType: "PLASTIC",
      quantityBand: "LARGE",
      slotPeriod: "AFTERNOON",
      address: "Shop 12, Pruthvi Circle, Pune",
      requestedDate: new Date().toISOString(),
    });
    if (!bookRes2.ok) throw new Error("Second booking failed");
    const pickup2Id = bookRes2.data.pickup.id;
    testPickupIds.push(pickup2Id);

    const dedicatedReject = await req(`/pickups/${pickup2Id}/reject`, "POST", adminToken, {});
    if (!dedicatedReject.ok) {
      throw new Error(`Dedicated /reject endpoint failed: ${JSON.stringify(dedicatedReject.data)}`);
    }
    const dbPickup2 = await prisma.pickup.findUnique({ where: { id: pickup2Id } });
    if (dbPickup2.status !== "rejected") {
      throw new Error(`Pickup 2 status expected 'rejected', got '${dbPickup2.status}'`);
    }
    console.log(`✓ [Step 9] Dedicated /api/pickups/:id/reject endpoint verified with default reason: '${dbPickup2.rejectionReason}'`);

    // Step 10: State transition rule - Completed pickup cannot be rejected
    const bookRes3 = await req("/pickups", "POST", citizenToken, {
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "SMALL",
      slotPeriod: "MORNING",
      address: "Flat 101, Anand Vihar, Pune",
      requestedDate: new Date().toISOString(),
    });
    const pickup3Id = bookRes3.data.pickup.id;
    testPickupIds.push(pickup3Id);

    // Force mark completed directly
    await prisma.pickup.update({
      where: { id: pickup3Id },
      data: { status: "completed" },
    });

    const rejectCompleted = await req(`/pickups/${pickup3Id}/status`, "PATCH", adminToken, {
      status: "rejected",
      rejectionReason: "Trying to reject completed pickup",
    });
    if (rejectCompleted.status === 400) {
      console.log("✓ [Step 10] Ineligible status blocked: Completed pickup cannot be rejected (HTTP 400).");
    } else {
      throw new Error(`Expected HTTP 400 when attempting to reject completed pickup, got ${rejectCompleted.status}`);
    }

    console.log("\n====================================================");
    console.log("   ALL REJECTION WORKFLOW TESTS PASSED (10/10)      ");
    console.log("====================================================");
  } finally {
    await cleanupTestData();
  }
}

runRejectionWorkflowTests().catch(async (err) => {
  console.error("\n❌ Rejection test failed:", err);
  await cleanupTestData();
  process.exit(1);
});
