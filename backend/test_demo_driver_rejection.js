require("dotenv").config();
const prisma = require("./src/db/client");
const bcrypt = require("bcryptjs");

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:4000/api";

async function runDemoDriverRejectionTests() {
  console.log("================================================================================");
  console.log("   TESTING REAL SERVER ARRIVAL VALIDATION: GEOFENCE RADIUS & STALE GPS");
  console.log("================================================================================");

  const testSuffix = Date.now().toString().slice(-6);
  let citizen, collector, vehicle, pickup, assignment;

  try {
    // 1. Create isolated fixtures for demo driver rejection testing
    citizen = await prisma.user.create({
      data: {
        name: `Demo Citizen ${testSuffix}`,
        email: `demo_citizen_${testSuffix}@example.com`,
        passwordHash: await bcrypt.hash("Password@123", 10),
        role: "citizen",
      },
    });

    collector = await prisma.user.create({
      data: {
        name: `Demo Collector ${testSuffix}`,
        email: `demo_collector_${testSuffix}@example.com`,
        passwordHash: await bcrypt.hash("Password@123", 10),
        role: "collector",
      },
    });

    vehicle = await prisma.vehicle.create({
      data: {
        registrationNo: `DEMO-TEST-${testSuffix}`,
        type: "Van",
        capacity: 500,
        driverId: collector.id,
        isActive: true,
        // Positioned 2,340 meters away (outside 300m arrival radius)
        currentLat: 16.8580,
        currentLng: 74.6150,
        currentSpeed: 30,
        currentHeading: 90,
        lastLocationAt: new Date(),
      },
    });

    // Pickup destination at Sangli Station Road (16.8413, 74.6016)
    pickup = await prisma.pickup.create({
      data: {
        userId: citizen.id,
        wasteType: "MIXED_RECYCLABLES",
        quantityBand: "MEDIUM",
        wasteQuantity: 4.5,
        address: "Station Road, Sangli District, Maharashtra",
        latitude: 16.8413,
        longitude: 74.6016,
        slotPeriod: "MORNING",
        requestedDate: new Date(),
        status: "assigned",
        assignedAdminId: collector.id,
      },
    });

    assignment = await prisma.pickupAssignment.create({
      data: {
        pickupId: pickup.id,
        vehicleId: vehicle.id,
        assignedById: collector.id,
        isActive: true,
      },
    });

    // 2. Authenticate collector via real REST login endpoint
    console.log(`[Step 1] Authenticating collector (${collector.email}) via POST /api/auth/login...`);
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: collector.email, password: "Password@123" }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login failed with status ${loginRes.status}`);
    }

    const { token } = await loginRes.json();
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    console.log("✓ Collector authenticated with real JWT.");

    // 3. Transition to on_the_way
    console.log("[Step 2] Driver starts trip via PATCH /api/driver/pickups/:id/status...");
    const startRes = await fetch(`${API_BASE}/driver/pickups/${pickup.id}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "on_the_way" }),
    });

    if (!startRes.ok) {
      const err = await startRes.json();
      throw new Error(`Start trip failed: ${JSON.stringify(err)}`);
    }
    console.log("✓ Pickup transitioned to 'on_the_way'.");

    // 4. Test Case 1: Attempt arrival outside 300m arrival radius (~2,340m away)
    console.log("[Step 3] Testing arrival rejection outside 300m radius (vehicle ~2.3 km away)...");
    const outsideRes = await fetch(`${API_BASE}/driver/pickups/${pickup.id}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "arrived" }),
    });

    const outsideBody = await outsideRes.json();
    if (outsideRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for out-of-radius arrival, got ${outsideRes.status}: ${JSON.stringify(outsideBody)}`);
    }

    if (!outsideBody.error || !outsideBody.error.includes("allowed radius: 300m")) {
      throw new Error(`Unexpected error message: ${JSON.stringify(outsideBody)}`);
    }
    console.log(`✓ Rejection verified (HTTP 400): "${outsideBody.error}"`);

    // 5. Test Case 2: Attempt arrival with stale GPS (>60s old)
    console.log("[Step 4] Testing arrival rejection with stale GPS (>60s old)...");
    // Move vehicle within 50m of pickup destination, but with timestamp 75s in the past
    const staleTime = new Date(Date.now() - 75 * 1000);
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        currentLat: 16.8414,
        currentLng: 74.6017, // ~15m from pickup destination
        lastLocationAt: staleTime,
      },
    });

    const staleRes = await fetch(`${API_BASE}/driver/pickups/${pickup.id}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "arrived" }),
    });

    const staleBody = await staleRes.json();
    if (staleRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for stale GPS arrival, got ${staleRes.status}: ${JSON.stringify(staleBody)}`);
    }

    if (!staleBody.error || !staleBody.error.includes("is stale") || !staleBody.error.includes("within the last 60 seconds")) {
      throw new Error(`Unexpected error message for stale GPS: ${JSON.stringify(staleBody)}`);
    }
    console.log(`✓ Rejection verified (HTTP 400): "${staleBody.error}"`);

    // 6. Test Case 3: Fresh in-radius GPS location (<300m and fresh) -> Accepted
    console.log("[Step 5] Testing arrival acceptance with fresh in-radius telemetry (25m away, fresh timestamp)...");
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        currentLat: 16.84135,
        currentLng: 74.60165, // ~7m from destination
        lastLocationAt: new Date(),
      },
    });

    const validRes = await fetch(`${API_BASE}/driver/pickups/${pickup.id}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "arrived" }),
    });

    const validBody = await validRes.json();
    if (!validRes.ok) {
      throw new Error(`Valid arrival failed: ${JSON.stringify(validBody)}`);
    }

    if (validBody.pickup.status !== "arrived") {
      throw new Error(`Expected status 'arrived', got '${validBody.pickup.status}'`);
    }
    console.log("✓ Arrival accepted (HTTP 200): Pickup transitioned to 'arrived' cleanly.");

    console.log("\n================================================================================");
    console.log("   ALL REAL SERVER ARRIVAL & GPS REJECTION TESTS PASSED (3/3)");
    console.log("================================================================================");
  } finally {
    // Teardown
    if (pickup) {
      await prisma.pickupAssignment.deleteMany({ where: { pickupId: pickup.id } });
      await prisma.pointsLedger.deleteMany({ where: { pickupId: pickup.id } });
      await prisma.pickup.deleteMany({ where: { id: pickup.id } });
    }
    if (vehicle) {
      await prisma.vehicleLocation.deleteMany({ where: { vehicleId: vehicle.id } });
      await prisma.vehicle.deleteMany({ where: { id: vehicle.id } });
    }
    if (citizen) {
      await prisma.user.deleteMany({ where: { id: citizen.id } });
    }
    if (collector) {
      await prisma.user.deleteMany({ where: { id: collector.id } });
    }
    console.log("✓ Isolated test fixtures cleaned up cleanly.");
  }
}

runDemoDriverRejectionTests()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
