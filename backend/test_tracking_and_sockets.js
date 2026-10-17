require("dotenv").config();
const { io } = require("socket.io-client");
const jwt = require("jsonwebtoken");
const prisma = require("./src/db/client");
const { assignVehicleToPickup } = require("./src/services/assignmentService");
const { transitionPickupStatus } = require("./src/services/pickupStatusService");

const API_BASE = "http://localhost:4000/api";
const SOCKET_BASE = "http://localhost:4000";

// Unique run ID for dedicated test isolation
const RUN_ID = Date.now();
const testCreatedUserIds = [];
const testCreatedVehicleIds = [];
const testCreatedPickupIds = [];

let testAdmin, testCollector, testCitizen, strangerCitizen, unassignedCollector;
let adminToken, collectorToken, citizenToken, strangerToken, unassignedCollectorToken;
let testVehicle, testPickupA, testPickupB;

async function setupIsolatedTestData() {
  console.log(`\n--- [SETUP] Creating Isolated Test Fixtures (Run ID: ${RUN_ID}) ---`);

  // 1. Create Dedicated Test Users (No dev data pollution)
  testAdmin = await prisma.user.create({
    data: {
      name: `Test Admin ${RUN_ID}`,
      email: `test-admin-${RUN_ID}@wastewise.test`,
      passwordHash: "dummyHash",
      role: "admin",
    },
  });
  testCreatedUserIds.push(testAdmin.id);

  testCollector = await prisma.user.create({
    data: {
      name: `Test Collector ${RUN_ID}`,
      email: `test-collector-${RUN_ID}@wastewise.test`,
      passwordHash: "dummyHash",
      role: "collector",
    },
  });
  testCreatedUserIds.push(testCollector.id);

  unassignedCollector = await prisma.user.create({
    data: {
      name: `Unassigned Collector ${RUN_ID}`,
      email: `test-unassigned-${RUN_ID}@wastewise.test`,
      passwordHash: "dummyHash",
      role: "collector",
    },
  });
  testCreatedUserIds.push(unassignedCollector.id);

  testCitizen = await prisma.user.create({
    data: {
      name: `Test Citizen ${RUN_ID}`,
      email: `test-citizen-${RUN_ID}@wastewise.test`,
      passwordHash: "dummyHash",
      role: "citizen",
    },
  });
  testCreatedUserIds.push(testCitizen.id);

  strangerCitizen = await prisma.user.create({
    data: {
      name: `Stranger Citizen ${RUN_ID}`,
      email: `test-stranger-${RUN_ID}@wastewise.test`,
      passwordHash: "dummyHash",
      role: "citizen",
    },
  });
  testCreatedUserIds.push(strangerCitizen.id);

  // 2. Dedicated Test Vehicle
  testVehicle = await prisma.vehicle.create({
    data: {
      registrationNo: `TST-${RUN_ID.toString().slice(-6)}`,
      type: "Test Electric Van",
      capacity: 500,
      driverId: testCollector.id,
      isActive: true,
      currentLat: 19.0657,
      currentLng: 72.8687,
      lastLocationAt: new Date(),
    },
  });
  testCreatedVehicleIds.push(testVehicle.id);

  // 3. Create Two Test Pickups for the Citizen
  testPickupA = await prisma.pickup.create({
    data: {
      userId: testCitizen.id,
      wasteType: "PLASTIC",
      quantityBand: "MEDIUM",
      address: "101 Marine Drive, Mumbai",
      latitude: 19.055,
      longitude: 72.835,
      slotPeriod: "MORNING",
      requestedDate: new Date(),
      status: "requested",
    },
  });
  testCreatedPickupIds.push(testPickupA.id);

  testPickupB = await prisma.pickup.create({
    data: {
      userId: testCitizen.id,
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "LARGE",
      address: "202 Linking Road, Mumbai",
      latitude: 19.058,
      longitude: 72.838,
      slotPeriod: "AFTERNOON",
      requestedDate: new Date(),
      status: "requested",
    },
  });
  testCreatedPickupIds.push(testPickupB.id);

  // 4. Generate Tokens
  const secret = process.env.JWT_SECRET;
  adminToken = jwt.sign({ sub: testAdmin.id, role: testAdmin.role }, secret, { expiresIn: "1h" });
  collectorToken = jwt.sign({ sub: testCollector.id, role: testCollector.role }, secret, {
    expiresIn: "1h",
  });
  unassignedCollectorToken = jwt.sign(
    { sub: unassignedCollector.id, role: unassignedCollector.role },
    secret,
    { expiresIn: "1h" }
  );
  citizenToken = jwt.sign({ sub: testCitizen.id, role: testCitizen.role }, secret, {
    expiresIn: "1h",
  });
  strangerToken = jwt.sign({ sub: strangerCitizen.id, role: strangerCitizen.role }, secret, {
    expiresIn: "1h",
  });

  console.log(`✓ Isolated test users, vehicle (${testVehicle.registrationNo}), and 2 pickups created.`);
}

async function cleanupIsolatedTestData() {
  console.log("\n--- [TEARDOWN] Purging Isolated Test Fixtures ---");
  try {
    // Delete in reverse dependency order
    if (testCreatedPickupIds.length > 0) {
      await prisma.pointsLedger.deleteMany({ where: { pickupId: { in: testCreatedPickupIds } } });
      await prisma.pickupAssignment.deleteMany({
        where: { pickupId: { in: testCreatedPickupIds } },
      });
      await prisma.pickup.deleteMany({ where: { id: { in: testCreatedPickupIds } } });
    }
    if (testCreatedVehicleIds.length > 0) {
      await prisma.vehicleLocation.deleteMany({
        where: { vehicleId: { in: testCreatedVehicleIds } },
      });
      await prisma.pickupAssignment.deleteMany({
        where: { vehicleId: { in: testCreatedVehicleIds } },
      });
      await prisma.vehicle.deleteMany({ where: { id: { in: testCreatedVehicleIds } } });
    }
    if (testCreatedUserIds.length > 0) {
      await prisma.userBadge.deleteMany({ where: { userId: { in: testCreatedUserIds } } });
      await prisma.pointsLedger.deleteMany({ where: { userId: { in: testCreatedUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testCreatedUserIds } } });
    }
    console.log("✓ All isolated test entities purged. Zero dev data pollution.");
  } catch (err) {
    console.error("Warning during teardown:", err.message);
  }
}

async function testRESTAuthorization() {
  console.log("\n--- [TEST 1] REST Security & Tracking Authorization ---");

  // 1. Assign testVehicle to testPickupA
  await assignVehicleToPickup({
    pickupId: testPickupA.id,
    vehicleId: testVehicle.id,
    adminUserId: testAdmin.id,
  });

  // 2. Stranger Citizen calls GET /api/pickups/:id/tracking -> MUST BE 403 FORBIDDEN
  const strangerRes = await fetch(`${API_BASE}/pickups/${testPickupA.id}/tracking`, {
    headers: { Authorization: `Bearer ${strangerToken}` },
  });
  if (strangerRes.status === 403) {
    console.log(`✓ 1.1: Stranger GET /api/pickups/:id/tracking correctly blocked: HTTP 403 Forbidden`);
  } else {
    throw new Error(`Expected HTTP 403 for stranger tracking, received: ${strangerRes.status}`);
  }

  // 3. Citizen Owner calls GET /api/pickups/:id/tracking -> MUST BE 200 OK
  const ownerRes = await fetch(`${API_BASE}/pickups/${testPickupA.id}/tracking`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  if (ownerRes.status === 200) {
    const data = await ownerRes.json();
    console.log(
      `✓ 1.2: Owner GET /api/pickups/:id/tracking succeeded: HTTP 200 (Vehicle: ${data.tracking.vehicle.registrationNo})`
    );
  } else {
    throw new Error(`Expected HTTP 200 for owner tracking, received: ${ownerRes.status}`);
  }
}

async function testStatusTransitionsAndGuards() {
  console.log("\n--- [TEST 2] Lifecycle Transitions, Reassignment & Guards ---");

  // 1. Transition assigned -> on_the_way
  const onTheWay = await transitionPickupStatus({
    pickupId: testPickupA.id,
    targetStatus: "on_the_way",
    user: testCollector,
  });
  console.log(`✓ 2.1: Started trip -> status: ${onTheWay.pickup.status}, startedAt: ${Boolean(onTheWay.pickup.assignments[0]?.startedAt)}`);

  // 2. Reassignment while in-transit must be BLOCKED with 409
  try {
    await assignVehicleToPickup({
      pickupId: testPickupA.id,
      vehicleId: testVehicle.id,
      adminUserId: testAdmin.id,
    });
    throw new Error("Expected 409 on in-transit reassignment!");
  } catch (err) {
    if (err.status === 409) {
      console.log(`✓ 2.2: Reassignment in-transit blocked with 409: "${err.message}"`);
    } else throw err;
  }

  // 3. Cancellation while in-transit must be BLOCKED with 400
  try {
    await transitionPickupStatus({
      pickupId: testPickupA.id,
      targetStatus: "cancelled",
      user: testCitizen,
    });
    throw new Error("Expected 400 on in-transit cancellation!");
  } catch (err) {
    console.log(`✓ 2.3: In-transit cancellation blocked: "${err.message}"`);
  }

  // 4. Arrival radius check on server: vehicle is at 19.0657, 72.8687 while pickup is at 19.055, 72.835 (>3000m away)
  try {
    await transitionPickupStatus({
      pickupId: testPickupA.id,
      targetStatus: "arrived",
      user: testCollector,
    });
    throw new Error("Expected 400 for vehicle too far from pickup location!");
  } catch (err) {
    console.log(`✓ 2.4: Server-side arrival radius check correctly blocked: "${err.message}"`);
  }

  // 5. Update vehicle location to destination (< 300m) and mark arrived
  await prisma.vehicle.update({
    where: { id: testVehicle.id },
    data: {
      currentLat: testPickupA.latitude,
      currentLng: testPickupA.longitude,
      lastLocationAt: new Date(),
    },
  });

  await transitionPickupStatus({
    pickupId: testPickupA.id,
    targetStatus: "arrived",
    user: testCollector,
  });
  console.log("✓ 2.5: Vehicle arrived at destination within radius -> status: arrived");

  // 6. Arrived -> Completed with idempotent points
  const completed = await transitionPickupStatus({
    pickupId: testPickupA.id,
    targetStatus: "completed",
    user: testCollector,
    wasteQuantity: 3.5,
  });
  console.log(`✓ 2.6: Completed pickup -> pointsAwarded: ${completed.ledgerEntry?.pointsEarned}`);

  // 7. Idempotent re-completion
  const reCompleted = await transitionPickupStatus({
    pickupId: testPickupA.id,
    targetStatus: "completed",
    user: testCollector,
  });
  console.log(`✓ 2.7: Idempotent re-completion verified -> points: ${reCompleted.ledgerEntry?.pointsEarned}`);
}

async function testSocketSecurityAndMultiRoomBroadcasts() {
  console.log("\n--- [TEST 3] Socket.IO Auth, Room Isolation & Dual-Pickup Broadcast ---");

  // 1. Token tests: invalid/expired token must fail
  await new Promise((resolve) => {
    const badSocket = io(SOCKET_BASE, {
      auth: { token: "invalid.jwt.token.here" },
      transports: ["websocket"],
    });
    badSocket.on("connect_error", (err) => {
      console.log(`✓ 3.1: Invalid token rejected during handshake: "${err.message}"`);
      badSocket.disconnect();
      resolve();
    });
  });

  // 2. Unassigned Collector emits location -> must be ignored / return error
  const unassignedSocket = io(SOCKET_BASE, {
    auth: { token: unassignedCollectorToken },
    transports: ["websocket"],
  });
  await new Promise((resolve) => unassignedSocket.on("connect", resolve));

  await new Promise((resolve) => {
    unassignedSocket.emit(
      "driver:location",
      { lat: 19.065, lng: 72.868, speed: 20, heading: 90 },
      (ack) => {
        if (ack?.error) {
          console.log(`✓ 3.2: Unassigned collector emission rejected: "${ack.error}"`);
          unassignedSocket.disconnect();
          resolve();
        } else {
          throw new Error("Security failure: unassigned collector was allowed to emit location!");
        }
      }
    );
  });

  // 3. Invalid lat/lng payloads -> must be rejected
  const collectorSocket = io(SOCKET_BASE, {
    auth: { token: collectorToken },
    transports: ["websocket"],
  });
  await new Promise((resolve) => collectorSocket.on("connect", resolve));

  // Assign testVehicle to testPickupB so testCollector has an active assignment
  await assignVehicleToPickup({
    pickupId: testPickupB.id,
    vehicleId: testVehicle.id,
    adminUserId: testAdmin.id,
  });

  await new Promise((resolve) => {
    collectorSocket.emit(
      "driver:location",
      { lat: 195.5, lng: 72.868 }, // invalid latitude > 90
      (ack) => {
        if (ack?.error) {
          console.log(`✓ 3.3: Invalid coordinate payload rejected: "${ack.error}"`);
          resolve();
        } else {
          throw new Error("Expected coordinate validation error for lat > 90!");
        }
      }
    );
  });

  // 4. Room Isolation & Negative Filtering Check:
  // Create another isolated pickup C for stranger
  const strangerPickup = await prisma.pickup.create({
    data: {
      userId: strangerCitizen.id,
      wasteType: "GLASS",
      quantityBand: "SMALL",
      address: "303 Stranger Boulevard",
      slotPeriod: "MORNING",
      requestedDate: new Date(),
      status: "assigned",
      assignedAdminId: testCollector.id,
    },
  });
  testCreatedPickupIds.push(strangerPickup.id);

  // Connect citizen socket
  const citizenSocket = io(SOCKET_BASE, {
    auth: { token: citizenToken },
    transports: ["websocket"],
  });
  await new Promise((resolve) => citizenSocket.on("connect", resolve));

  // Citizen joins room for Pickup B ONLY
  await new Promise((resolve) => {
    citizenSocket.emit("join:pickup", { pickupId: testPickupB.id }, resolve);
  });
  console.log(`✓ 3.4: Citizen subscribed ONLY to room pickup:${testPickupB.id}`);

  let receivedForB = null;
  let receivedForStranger = null;

  citizenSocket.on("vehicle:location", (data) => {
    if (data.pickupId === testPickupB.id) receivedForB = data;
    if (data.pickupId === strangerPickup.id) receivedForStranger = data;
  });

  // 5. Test Dual-Pickup Broadcast:
  // Also assign testVehicle to strangerPickup as a second active pickup!
  await prisma.pickupAssignment.create({
    data: {
      pickupId: strangerPickup.id,
      vehicleId: testVehicle.id,
      assignedById: testAdmin.id,
      isActive: true,
    },
  });

  // Connect Stranger Socket and join strangerPickup room
  const strangerSocket = io(SOCKET_BASE, {
    auth: { token: strangerToken },
    transports: ["websocket"],
  });
  await new Promise((resolve) => strangerSocket.on("connect", resolve));

  let strangerReceivedData = null;
  strangerSocket.on("vehicle:location", (data) => {
    if (data.pickupId === strangerPickup.id) strangerReceivedData = data;
  });

  await new Promise((resolve) => {
    strangerSocket.emit("join:pickup", { pickupId: strangerPickup.id }, resolve);
  });

  // Wait 3.1 seconds to clear rate limit
  await new Promise((r) => setTimeout(r, 3100));

  // Collector emits valid location for vehicle
  await new Promise((resolve) => {
    collectorSocket.emit(
      "driver:location",
      { lat: 19.0567, lng: 72.8367, speed: 28, heading: 180 },
      (ack) => {
        resolve();
      }
    );
  });

  // Wait 500ms for websocket delivery
  await new Promise((r) => setTimeout(r, 500));

  if (receivedForB && strangerReceivedData) {
    console.log(
      `✓ 3.5: Dual-pickup broadcast verified: BOTH active pickup rooms (pickup:${testPickupB.id} & pickup:${strangerPickup.id}) received telemetry.`
    );
  } else {
    throw new Error("Dual-pickup broadcast failed: one or both rooms missed update.");
  }

  // Confirm Room Isolation: Citizen in room B did NOT receive strangerPickup's message
  if (receivedForStranger === null) {
    console.log(
      `✓ 3.6: Room Isolation Verified: Citizen in room pickup:${testPickupB.id} received 0 broadcasts for stranger's pickup:${strangerPickup.id}.`
    );
  } else {
    throw new Error("Security leak: Citizen received broadcasts for a room they did not join!");
  }

  // Disconnect all sockets
  citizenSocket.disconnect();
  strangerSocket.disconnect();
  collectorSocket.disconnect();
  unassignedSocket.disconnect();
}

async function testSecurityArrivalRadiusBypassBlocked() {
  console.log("\n--- [TEST 4] Security: Client Bypass Rejection & GPS Staleness Checks ---");

  // 1. Create a fresh pickup for testing arrival guards
  const arrivalPickup = await prisma.pickup.create({
    data: {
      userId: testCitizen.id,
      wasteType: "PLASTIC",
      quantityBand: "MEDIUM",
      address: "404 Colaba Causeway, Mumbai",
      latitude: 18.9067,
      longitude: 72.8147,
      slotPeriod: "MORNING",
      requestedDate: new Date(),
      status: "assigned",
    },
  });
  testCreatedPickupIds.push(arrivalPickup.id);

  await assignVehicleToPickup({
    pickupId: arrivalPickup.id,
    vehicleId: testVehicle.id,
    adminUserId: testAdmin.id,
  });

  // Put vehicle far away (~17km away in Bandra) with recent timestamp
  await prisma.vehicle.update({
    where: { id: testVehicle.id },
    data: {
      currentLat: 19.0600,
      currentLng: 72.8400,
      lastLocationAt: new Date(),
    },
  });

  // Start trip -> on_the_way
  const startRes = await fetch(`${API_BASE}/driver/pickups/${arrivalPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${collectorToken}`,
    },
    body: JSON.stringify({ status: "on_the_way" }),
  });
  if (startRes.status !== 200) {
    throw new Error(`Failed to start trip: ${startRes.status}`);
  }
  console.log("✓ 4.1: Trip started -> on_the_way");

  // ATTEMPT CLIENT-CONTROLLED BYPASS: Driver sends skipArrivalRadiusCheck: true while far away
  // MUST RETURN HTTP 400!
  const bypassRes = await fetch(`${API_BASE}/driver/pickups/${arrivalPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${collectorToken}`,
    },
    body: JSON.stringify({
      status: "arrived",
      skipArrivalRadiusCheck: true, // CLIENT EXPLOIT ATTEMPT
    }),
  });

  if (bypassRes.status === 400) {
    const errBody = await bypassRes.json();
    console.log(
      `✓ 4.2: SECURITY: Client bypass attempt 'skipArrivalRadiusCheck: true' rejected with HTTP 400: "${errBody.error}"`
    );
  } else {
    throw new Error(
      `Security failure! Expected HTTP 400 for skipArrivalRadiusCheck bypass, received: ${bypassRes.status}`
    );
  }

  // TEST STALE VEHICLE LOCATION (>60s)
  const staleDate = new Date(Date.now() - 75000); // 75 seconds ago
  await prisma.vehicle.update({
    where: { id: testVehicle.id },
    data: {
      currentLat: arrivalPickup.latitude,
      currentLng: arrivalPickup.longitude,
      lastLocationAt: staleDate,
    },
  });

  const staleRes = await fetch(`${API_BASE}/driver/pickups/${arrivalPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${collectorToken}`,
    },
    body: JSON.stringify({ status: "arrived" }),
  });

  if (staleRes.status === 400) {
    const errBody = await staleRes.json();
    console.log(
      `✓ 4.3: Stale location (>60s) on arrival check correctly rejected with HTTP 400: "${errBody.error}"`
    );
  } else {
    throw new Error(`Expected HTTP 400 for stale vehicle location, got: ${staleRes.status}`);
  }

  // TEST NULL VEHICLE LOCATION
  await prisma.vehicle.update({
    where: { id: testVehicle.id },
    data: {
      currentLat: null,
      currentLng: null,
      lastLocationAt: null,
    },
  });

  const nullRes = await fetch(`${API_BASE}/driver/pickups/${arrivalPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${collectorToken}`,
    },
    body: JSON.stringify({ status: "arrived" }),
  });

  if (nullRes.status === 400) {
    const errBody = await nullRes.json();
    console.log(
      `✓ 4.4: Null GPS location on arrival check correctly rejected with HTTP 400: "${errBody.error}"`
    );
  } else {
    throw new Error(`Expected HTTP 400 for null vehicle location, got: ${nullRes.status}`);
  }

  // TEST NULL PICKUP COORDINATES
  await prisma.pickup.update({
    where: { id: arrivalPickup.id },
    data: { latitude: null, longitude: null },
  });
  // Restore vehicle location
  await prisma.vehicle.update({
    where: { id: testVehicle.id },
    data: { currentLat: 18.9067, currentLng: 72.8147, lastLocationAt: new Date() },
  });

  const nullPickupCoordsRes = await fetch(`${API_BASE}/driver/pickups/${arrivalPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${collectorToken}`,
    },
    body: JSON.stringify({ status: "arrived" }),
  });

  if (nullPickupCoordsRes.status === 400) {
    const errBody = await nullPickupCoordsRes.json();
    console.log(
      `✓ 4.5: Missing pickup destination coordinates rejected with HTTP 400: "${errBody.error}"`
    );
  } else {
    throw new Error(`Expected HTTP 400 for null pickup coordinates, got: ${nullPickupCoordsRes.status}`);
  }
}

async function testVehicleValidationAndConflictGuards() {
  console.log("\n--- [TEST 5] Vehicle Validation & 409 Conflict Protection ---");

  // 1. Assigning driver with non-collector role -> 400
  const citizenDriverRes = await fetch(`${API_BASE}/admin/vehicles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      registrationNo: `TST-INVALID-${RUN_ID.toString().slice(-4)}`,
      type: "Electric Trike",
      capacity: 250,
      driverId: testCitizen.id, // Citizen, not collector!
    }),
  });
  if (citizenDriverRes.status === 400) {
    const errBody = await citizenDriverRes.json();
    console.log(
      `✓ 5.1: Non-collector driver assignment correctly rejected with HTTP 400: "${errBody.error}"`
    );
  } else {
    throw new Error(`Expected HTTP 400 for non-collector driver, got: ${citizenDriverRes.status}`);
  }

  // 2. Assigning driver who is ALREADY assigned to another vehicle -> 400
  const duplicateDriverRes = await fetch(`${API_BASE}/admin/vehicles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      registrationNo: `TST-DUP-${RUN_ID.toString().slice(-4)}`,
      type: "Electric Trike",
      capacity: 250,
      driverId: testCollector.id, // already assigned to testVehicle
    }),
  });
  if (duplicateDriverRes.status === 400) {
    const errBody = await duplicateDriverRes.json();
    console.log(
      `✓ 5.2: Reassigning busy driver to second vehicle rejected with HTTP 400: "${errBody.error}"`
    );
  } else {
    throw new Error(`Expected HTTP 400 for already assigned driver, got: ${duplicateDriverRes.status}`);
  }

  // 3. Deactivating a vehicle with active assignments -> 409 Conflict
  const deactivateConflictRes = await fetch(`${API_BASE}/admin/vehicles/${testVehicle.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ isActive: false }),
  });
  if (deactivateConflictRes.status === 409) {
    const errBody = await deactivateConflictRes.json();
    console.log(
      `✓ 5.3: Deactivating vehicle with active assignments blocked with HTTP 409 Conflict: "${errBody.error}"`
    );
  } else {
    throw new Error(`Expected HTTP 409 for deactivating busy vehicle, got: ${deactivateConflictRes.status}`);
  }

  // 4. Changing driver of a vehicle with active assignments -> 409 Conflict
  const changeDriverConflictRes = await fetch(`${API_BASE}/admin/vehicles/${testVehicle.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ driverId: unassignedCollector.id }),
  });
  if (changeDriverConflictRes.status === 409) {
    const errBody = await changeDriverConflictRes.json();
    console.log(
      `✓ 5.4: Changing driver on vehicle with active assignments blocked with HTTP 409 Conflict: "${errBody.error}"`
    );
  } else {
    throw new Error(`Expected HTTP 409 for changing driver on busy vehicle, got: ${changeDriverConflictRes.status}`);
  }
}

async function testNewlyCreatedPickupFullFlow() {
  console.log("\n--- [TEST 6] Complete End-to-End Flow With Brand-New Non-Seeded Pickup ---");

  // Step 1: Citizen creates a brand new pickup request with coordinates
  const newPickupLat = 19.1136;
  const newPickupLng = 72.8697;
  const createRes = await fetch(`${API_BASE}/pickups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${citizenToken}`,
    },
    body: JSON.stringify({
      wasteType: "E_WASTE",
      quantityBand: "MEDIUM",
      address: "Andheri East Eco Park, Mumbai",
      latitude: newPickupLat,
      longitude: newPickupLng,
      slotPeriod: "AFTERNOON",
      requestedDate: new Date().toISOString(),
    }),
  });
  if (createRes.status !== 201) {
    throw new Error(`Failed to create new pickup: ${createRes.status}`);
  }
  const createBody = await createRes.json();
  const newPickup = createBody.pickup;
  testCreatedPickupIds.push(newPickup.id);
  console.log(
    `✓ Step 1: Citizen created new pickup ${newPickup.id} (Status: ${newPickup.status}, Lat: ${newPickup.latitude}, Lng: ${newPickup.longitude})`
  );

  // Step 2: Admin creates a dedicated active vehicle for this collector
  const flowCollector = await prisma.user.create({
    data: {
      name: `Flow Collector ${RUN_ID}`,
      email: `flow-collector-${RUN_ID}@wastewise.test`,
      passwordHash: "dummyHash",
      role: "collector",
    },
  });
  testCreatedUserIds.push(flowCollector.id);
  const flowCollectorToken = jwt.sign(
    { sub: flowCollector.id, role: flowCollector.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const flowVehicle = await prisma.vehicle.create({
    data: {
      registrationNo: `FLW-${RUN_ID.toString().slice(-6)}`,
      type: "Eco Electric Truck",
      capacity: 800,
      driverId: flowCollector.id,
      isActive: true,
      currentLat: 19.1100,
      currentLng: 72.8650,
      lastLocationAt: new Date(),
    },
  });
  testCreatedVehicleIds.push(flowVehicle.id);

  // Admin assigns vehicle to newly created pickup
  const assignRes = await fetch(`${API_BASE}/admin/pickups/${newPickup.id}/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ vehicleId: flowVehicle.id }),
  });
  if (assignRes.status !== 200) {
    throw new Error(`Admin vehicle assignment failed: ${assignRes.status}`);
  }
  const assignData = await assignRes.json();
  console.log(
    `✓ Step 2: Admin assigned vehicle ${flowVehicle.registrationNo} to pickup -> Status: ${assignData.pickup.status}`
  );

  // Step 3: Citizen views tracking endpoint
  const trackRes = await fetch(`${API_BASE}/pickups/${newPickup.id}/tracking`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  if (trackRes.status !== 200) {
    throw new Error(`Tracking fetch failed: ${trackRes.status}`);
  }
  const trackData = await trackRes.json();
  console.log(
    `✓ Step 3: Citizen tracking active: assigned vehicle ${trackData.tracking.vehicle.registrationNo}, driver: ${trackData.tracking.driver?.name}`
  );

  // Step 4: Collector starts trip -> on_the_way
  const tripRes = await fetch(`${API_BASE}/driver/pickups/${newPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${flowCollectorToken}`,
    },
    body: JSON.stringify({ status: "on_the_way" }),
  });
  if (tripRes.status !== 200) {
    throw new Error(`Collector start trip failed: ${tripRes.status}`);
  }
  console.log("✓ Step 4: Collector started trip -> status: on_the_way");

  // Step 5: Collector transmits live GPS telemetry over Socket.IO
  const flowDriverSocket = io(SOCKET_BASE, {
    auth: { token: flowCollectorToken },
    transports: ["websocket"],
  });
  await new Promise((resolve) => flowDriverSocket.on("connect", resolve));

  // Move vehicle to within 100m of destination
  const arrivedLat = newPickupLat + 0.0005; // ~55m away
  const arrivedLng = newPickupLng + 0.0005;

  await new Promise((resolve) => {
    flowDriverSocket.emit(
      "driver:location",
      { lat: arrivedLat, lng: arrivedLng, speed: 12, heading: 45 },
      (ack) => {
        resolve();
      }
    );
  });
  await new Promise((r) => setTimeout(r, 600));
  flowDriverSocket.disconnect();
  console.log("✓ Step 5: Collector emitted GPS telemetry via Socket.IO (<100m from destination)");

  // Step 6: Collector marks arrived -> status: arrived
  const arrivedRes = await fetch(`${API_BASE}/driver/pickups/${newPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${flowCollectorToken}`,
    },
    body: JSON.stringify({ status: "arrived" }),
  });
  if (arrivedRes.status !== 200) {
    const err = await arrivedRes.json();
    throw new Error(`Failed to mark arrived: ${JSON.stringify(err)}`);
  }
  console.log("✓ Step 6: Collector verified arrival within radius -> status: arrived");

  // Step 7: Collector completes pickup with wasteQuantity -> status: completed
  const completeRes = await fetch(`${API_BASE}/driver/pickups/${newPickup.id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${flowCollectorToken}`,
    },
    body: JSON.stringify({ status: "completed", wasteQuantity: 5.4 }),
  });
  if (completeRes.status !== 200) {
    const err = await completeRes.json();
    throw new Error(`Failed to complete pickup: ${JSON.stringify(err)}`);
  }
  const completeData = await completeRes.json();
  console.log(
    `✓ Step 7: Collector completed pickup -> Status: ${completeData.pickup.status}, Points Earned: ${completeData.pointsEarned}, Waste: ${completeData.pickup.wasteQuantity}kg`
  );

  // Step 8: Verify citizen impact profile reflects the new points and waste
  const impactRes = await fetch(`${API_BASE}/pickups/my-impact`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  const impactData = await impactRes.json();
  console.log(
    `✓ Step 8: Citizen profile verified -> Total Waste: ${impactData.totalWasteContributed}kg, Green Points: ${impactData.totalPointsEarned}`
  );
}

async function runAll() {
  try {
    await setupIsolatedTestData();
    await testRESTAuthorization();
    await testStatusTransitionsAndGuards();
    await testSocketSecurityAndMultiRoomBroadcasts();
    await testSecurityArrivalRadiusBypassBlocked();
    await testVehicleValidationAndConflictGuards();
    await testNewlyCreatedPickupFullFlow();

    console.log("\n==================================================");
    console.log("🎉 ALL PHASE 5 SECURITY, VEHICLE & REAL-FLOW TESTS PASSED!");
    console.log("==================================================");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await cleanupIsolatedTestData();
    await prisma.$disconnect();
    if (process.exitCode === 1) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAll();

