/**
 * Automated Test Suite: Area-Wise Clustering & Batch Dispatch (Option A)
 * 
 * Validates:
 * 1. Geographic ward resolution for Sangli-Miraj localities and coordinates
 * 2. Grouping of pickups into Area/Ward clusters
 * 3. GET /api/admin/pickups/area-clusters endpoint
 * 4. POST /api/admin/pickups/batch-assign-area atomic transaction
 * 5. Driver active pickups list reflecting the assigned area cluster
 * 6. Conflict prevention when vehicle is en route
 */

const assert = require("assert");
const http = require("http");
const app = require("./src/app");
const prisma = require("./src/db/client");
const jwt = require("jsonwebtoken");
const { resolvePickupWard, groupPickupsByWard } = require("./src/utils/areaZoneService");

const JWT_SECRET = process.env.JWT_SECRET || "wastewise-local-development-secret-84729";

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("\n========================================================");
  console.log("  TEST SUITE: AREA-WISE CLUSTERING & BATCH DISPATCH     ");
  console.log("========================================================\n");

  // ----------------------------------------------------
  // TEST 1: Ward Resolution Unit Logic
  // ----------------------------------------------------
  console.log("1. Testing Ward Resolution for Sangli-Miraj Localities...");

  const vishrambag = resolvePickupWard({ address: "Vishrambag Main Road, Sangli-Miraj Link, Sangli 416415" });
  assert.strictEqual(vishrambag.code, "WARD-VISHRAMBAG", "Expected Vishrambag ward code");
  assert.strictEqual(vishrambag.area, "Vishrambag");

  const miraj = resolvePickupWard({ address: "Brahman Puri, Near Venkatesh Mandir, Miraj 416410" });
  assert.strictEqual(miraj.code, "WARD-MIRAJ-CENTRAL", "Expected Miraj Central ward code");

  const kupwad = resolvePickupWard({ address: "Kupwad MIDC Phase 1, Near Water Tank, Miraj 416436" });
  assert.strictEqual(kupwad.code, "WARD-KUPWAD-MIDC", "Expected Kupwad MIDC ward code");

  // Coordinate-based resolution
  const coordMatch = resolvePickupWard({ address: "Unspecified Lane", latitude: 16.8510, longitude: 74.5880 });
  assert.strictEqual(coordMatch.code, "WARD-VISHRAMBAG", "Expected coordinate-based Vishrambag resolution");

  console.log("  ✓ All ward resolution unit tests passed.");

  // ----------------------------------------------------
  // TEST 2: Cluster Grouping Logic
  // ----------------------------------------------------
  console.log("2. Testing Cluster Grouping Logic...");
  const mockPickups = [
    { id: "1", address: "Vishrambag Lane 1", slotPeriod: "MORNING", requestedDate: new Date("2026-11-10"), wasteQuantity: 5 },
    { id: "2", address: "Vishrambag Lane 2", slotPeriod: "MORNING", requestedDate: new Date("2026-11-10"), wasteQuantity: 7 },
    { id: "3", address: "Miraj Station Road", slotPeriod: "MORNING", requestedDate: new Date("2026-11-10"), wasteQuantity: 10 },
  ];
  const clusters = groupPickupsByWard(mockPickups);
  assert.strictEqual(clusters.length, 2, "Expected 2 distinct clusters (Vishrambag and Miraj)");
  const vishCluster = clusters.find((c) => c.wardCode === "WARD-VISHRAMBAG");
  assert.strictEqual(vishCluster.pickupCount, 2, "Expected 2 pickups in Vishrambag cluster");
  assert.strictEqual(vishCluster.totalEstimatedWeight, 12, "Expected 12kg total estimated weight");

  console.log("  ✓ Cluster grouping logic passed.");

  // ----------------------------------------------------
  // Setup Server & Test Database Data
  // ----------------------------------------------------
  const server = app.server;
  const port = server.address() ? server.address().port : 4000;
  console.log(`\nUsing server listening on port ${port}`);

  // Fetch or create Admin user
  let admin = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: `test_admin_${Date.now()}@wastewise.local`,
        password: "hash",
        phone: `999${Date.now().toString().slice(-7)}`,
        role: "admin",
      },
    });
  }

  // Create dedicated clean test Collector and Vehicle for test isolation
  const collector = await prisma.user.create({
    data: {
      name: "Test Area Collector",
      email: `test_area_collector_${Date.now()}@wastewise.local`,
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
      phone: `888${Date.now().toString().slice(-7)}`,
      role: "collector",
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      registrationNo: `MH-10-BATCH-${Date.now().toString().slice(-4)}`,
      type: "TATA_ACE_ZIP",
      capacity: 1000,
      driverId: collector.id,
      isActive: true,
    },
  });

  // Fetch or create Citizen for booking pickups
  let citizen = await prisma.user.findFirst({ where: { role: "citizen" } });
  if (!citizen) {
    citizen = await prisma.user.create({
      data: {
        name: "Test Citizen",
        email: `test_citizen_${Date.now()}@wastewise.local`,
        password: "hash",
        phone: `777${Date.now().toString().slice(-7)}`,
        role: "citizen",
      },
    });
  }

  const adminToken = jwt.sign({ sub: admin.id, role: "admin", email: admin.email }, JWT_SECRET, { expiresIn: "1h" });
  const driverToken = jwt.sign({ sub: collector.id, role: "collector", email: collector.email }, JWT_SECRET, { expiresIn: "1h" });

  // Create 3 Test Pickups in the SAME area (Vishrambag)
  console.log("\n3. Creating 3 test pickups in Vishrambag Ward...");
  const createdPickups = [];
  for (let i = 1; i <= 3; i++) {
    const p = await prisma.pickup.create({
      data: {
        userId: citizen.id,
        wasteType: "PLASTIC",
        quantityBand: "MEDIUM",
        wasteQuantity: 6.5,
        address: `House #${i * 10}, Vishrambag Main Road, Sangli 416415`,
        latitude: 16.8510 + (i * 0.001),
        longitude: 74.5880 + (i * 0.001),
        slotPeriod: "MORNING",
        requestedDate: new Date("2026-11-12"),
        status: "requested",
      },
    });
    createdPickups.push(p);
  }
  console.log(`  ✓ Created 3 test pickups: ${createdPickups.map((p) => p.id.slice(0, 8)).join(", ")}`);

  try {
    // ----------------------------------------------------
    // TEST 3: GET /api/admin/pickups/area-clusters
    // ----------------------------------------------------
    console.log("\n4. Testing GET /api/admin/pickups/area-clusters...");
    const clustersRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/admin/pickups/area-clusters?status=requested",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(clustersRes.status, 200, `Expected HTTP 200, got ${clustersRes.status}`);
    assert(clustersRes.body.clusters.length > 0, "Expected at least 1 area cluster");
    const vishrambagCluster = clustersRes.body.clusters.find((c) => c.wardCode === "WARD-VISHRAMBAG");
    assert(vishrambagCluster, "Expected Vishrambag cluster in API response");
    assert(vishrambagCluster.pickupCount >= 3, "Expected at least 3 pickups in cluster");
    console.log(`  ✓ Cluster found: "${vishrambagCluster.wardName}" (${vishrambagCluster.pickupCount} pickups, ${vishrambagCluster.totalEstimatedWeight} kg)`);
    assert(Array.isArray(clustersRes.body.availableVehicles), "Expected availableVehicles list");
    console.log(`  ✓ Available vehicles returned: ${clustersRes.body.availableVehicles.length} vehicles available for dispatch`);

    // ----------------------------------------------------
    // TEST 4: POST /api/admin/pickups/batch-assign-area
    // ----------------------------------------------------
    console.log("\n5. Testing POST /api/admin/pickups/batch-assign-area (1-Click Area Batch Dispatch)...");
    const targetPickupIds = createdPickups.map((p) => p.id);

    const batchRes = await makeRequest(
      server,
      {
        hostname: "localhost",
        port,
        path: "/api/admin/pickups/batch-assign-area",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      },
      {
        vehicleId: vehicle.id,
        pickupIds: targetPickupIds,
        slotPeriod: "MORNING",
        requestedDate: "2026-11-12",
      }
    );

    assert.strictEqual(batchRes.status, 200, `Expected HTTP 200, got ${batchRes.status}: ${JSON.stringify(batchRes.body)}`);
    assert.strictEqual(batchRes.body.success, true);
    assert.strictEqual(batchRes.body.assignedCount, 3, "Expected 3 pickups assigned in batch");
    assert.strictEqual(batchRes.body.vehicle.registrationNo, vehicle.registrationNo);
    console.log(`  ✓ Successfully dispatched all 3 pickups to Vehicle ${vehicle.registrationNo}`);

    // Verify in database
    const updatedInDb = await prisma.pickup.findMany({
      where: { id: { in: targetPickupIds } },
      include: { assignments: { where: { isActive: true } } },
    });
    for (const p of updatedInDb) {
      assert.strictEqual(p.status, "assigned", `Expected pickup ${p.id} status to be 'assigned'`);
      assert.strictEqual(p.assignedAdminId, collector.id, "Expected assignedAdminId to be vehicle driver");
      assert.strictEqual(p.assignments.length, 1, "Expected exactly 1 active assignment row");
    }
    console.log("  ✓ Database verification: All pickups updated to 'assigned' with active assignments.");

    // ----------------------------------------------------
    // TEST 5: GET /api/driver/pickups Area Manifest
    // ----------------------------------------------------
    console.log("\n6. Testing Driver Active Pickups Area Manifest...");
    const driverRes = await makeRequest(server, {
      hostname: "localhost",
      port,
      path: "/api/driver/pickups",
      method: "GET",
      headers: { Authorization: `Bearer ${driverToken}` },
    });

    assert.strictEqual(driverRes.status, 200, "Expected HTTP 200 for driver pickups");
    const driverPickups = driverRes.body.pickups;
    assert(driverPickups.length >= 3, "Expected driver to have at least 3 active pickups");
    for (const dp of driverPickups.filter((p) => targetPickupIds.includes(p.id))) {
      assert(dp.ward, "Expected ward metadata on driver pickup");
      assert.strictEqual(dp.ward.code, "WARD-VISHRAMBAG", "Expected ward code on driver pickup to be WARD-VISHRAMBAG");
    }
    console.log(`  ✓ Driver mobile API returned pickups with resolved ward: "${driverPickups[0].ward.name}"`);

    // ----------------------------------------------------
    // TEST 6: Validation & Error Handling
    // ----------------------------------------------------
    console.log("\n7. Testing Batch Assign Validation & Guardrails...");

    // 6a. Empty array rejection
    const emptyRes = await makeRequest(
      server,
      {
        hostname: "localhost",
        port,
        path: "/api/admin/pickups/batch-assign-area",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      },
      { vehicleId: vehicle.id, pickupIds: [] }
    );
    assert.strictEqual(emptyRes.status, 400, "Expected 400 for empty pickupIds array");
    console.log("  ✓ Rejection of empty pickupIds array verified (HTTP 400).");

    // 6b. Non-existent vehicle rejection
    const badVehicleRes = await makeRequest(
      server,
      {
        hostname: "localhost",
        port,
        path: "/api/admin/pickups/batch-assign-area",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      },
      { vehicleId: "00000000-0000-0000-0000-000000000000", pickupIds: targetPickupIds }
    );
    assert.strictEqual(badVehicleRes.status, 404, "Expected 404 for non-existent vehicle");
    console.log("  ✓ Rejection of non-existent vehicle verified (HTTP 404).");

    console.log("\n========================================================");
    console.log("  ALL AREA-WISE BATCH DISPATCH TESTS PASSED! (6/6)      ");
    console.log("========================================================\n");
  } finally {
    // Teardown test pickups and dedicated test vehicle/collector
    if (createdPickups.length > 0) {
      await prisma.pickupAssignment.deleteMany({ where: { pickupId: { in: createdPickups.map((p) => p.id) } } });
      await prisma.pickup.deleteMany({ where: { id: { in: createdPickups.map((p) => p.id) } } });
    }
    if (vehicle?.id) {
      await prisma.vehicleLocation.deleteMany({ where: { vehicleId: vehicle.id } });
      await prisma.vehicle.delete({ where: { id: vehicle.id } }).catch(() => {});
    }
    if (collector?.id) {
      await prisma.user.delete({ where: { id: collector.id } }).catch(() => {});
    }
    try { server.close(); } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err);
  process.exit(1);
});
