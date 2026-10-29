require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");
const prisma = require("../src/db/client");

// Production safeguard
if (process.env.NODE_ENV === "production") {
  console.error("❌ Refusing to run smoke test in production environment.");
  process.exit(1);
}

const DEMO_CITIZEN_EMAIL = process.env.DEMO_CITIZEN_EMAIL || "demo_citizen@example.com";
const DEMO_VEHICLE_REG = process.env.DEMO_VEHICLE_REG || "DEMO-TRUCK-01";

async function runCommand(scriptName, args = []) {
  const scriptPath = path.join(__dirname, scriptName);
  console.log(`\n▶ Running: node ${scriptName} ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    env: { ...process.env, API_BASE_URL: "http://127.0.0.1:4000/api", SOCKET_BASE_URL: "http://127.0.0.1:4000" },
  });

  if (result.status !== 0) {
    throw new Error(`Step failed: node ${scriptName} exited with code ${result.status}`);
  }
}

async function runSmokeTest() {
  console.log("============================================================");
  console.log("🧪 [DEMO SMOKE] Starting Live-Tracking Demo Smoke Pipeline");
  console.log("============================================================");

  // 1. Run demo:seed
  await runCommand("demoSeed.js");

  // 2. Run demo:drive at speed=20 with auto-arrive
  await runCommand("simulateDriver.js", ["--speed=20", "--auto-arrive"]);

  // 3. Grace period for asynchronous telemetry history writes to settle
  await new Promise((res) => setTimeout(res, 1500));

  console.log("\n============================================================");
  console.log("🔍 [DEMO SMOKE] Verifying Real Database State");
  console.log("============================================================");

  // Query DB entities
  const citizen = await prisma.user.findUnique({
    where: { email: DEMO_CITIZEN_EMAIL },
  });

  const vehicle = await prisma.vehicle.findUnique({
    where: { registrationNo: DEMO_VEHICLE_REG },
  });

  if (!citizen || !vehicle) {
    console.error("❌ FAIL: Demo citizen or vehicle not found in database.");
    process.exit(1);
  }

  const pickup = await prisma.pickup.findFirst({
    where: { userId: citizen.id },
    orderBy: { createdAt: "desc" },
    include: { assignments: true },
  });

  const ledgerEntry = await prisma.pointsLedger.findFirst({
    where: { userId: citizen.id, pickupId: pickup?.id },
  });

  const vehicleLocations = await prisma.vehicleLocation.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { recordedAt: "asc" },
  });

  const assignments = await prisma.pickupAssignment.findMany({
    where: { vehicleId: vehicle.id },
  });

  let allPassed = true;

  // Assertion 1: Pickup status = completed
  const assert1 = pickup && pickup.status === "completed";
  console.log(
    assert1
      ? `✅ PASS [1/4]: Pickup status is 'completed' (actual: '${pickup?.status}')`
      : `❌ FAIL [1/4]: Pickup status is not 'completed' (actual: '${pickup?.status}')`
  );
  if (!assert1) allPassed = false;

  // Assertion 2: Points ledger row exists for the citizen
  const assert2 = Boolean(ledgerEntry && ledgerEntry.pointsEarned > 0);
  console.log(
    assert2
      ? `✅ PASS [2/4]: Points ledger row exists for citizen (earned: ${ledgerEntry?.pointsEarned} pts, id: ${ledgerEntry?.id})`
      : `❌ FAIL [2/4]: No points ledger row found for citizen`
  );
  if (!assert2) allPassed = false;

  // Assertion 3: Vehicle locations has rows for the vehicle
  const assert3 = vehicleLocations.length > 0;
  console.log(
    assert3
      ? `✅ PASS [3/4]: Vehicle locations has ${vehicleLocations.length} rows for ${vehicle.registrationNo}`
      : `❌ FAIL [3/4]: No vehicle locations recorded for ${vehicle.registrationNo}`
  );
  if (!assert3) allPassed = false;

  // Assertion 4: No row was written outside a trip
  const outsideTripRows = vehicleLocations.filter((loc) => {
    // A location is valid if it falls within the startedAt and completedAt bounds of any assignment
    const matchingTrip = assignments.some((a) => {
      if (!a.startedAt) return false;
      const startTime = new Date(a.startedAt).getTime() - 5000; // 5s clock buffer
      const endTime = a.completedAt ? new Date(a.completedAt).getTime() + 5000 : Date.now() + 5000;
      const locTime = new Date(loc.recordedAt).getTime();
      return locTime >= startTime && locTime <= endTime;
    });
    return !matchingTrip;
  });

  const assert4 = vehicleLocations.length > 0 && outsideTripRows.length === 0;
  console.log(
    assert4
      ? `✅ PASS [4/4]: No location rows written outside a trip (${vehicleLocations.length} in trip, 0 outside)`
      : `❌ FAIL [4/4]: Found ${outsideTripRows.length} location rows written outside active trip bounds`
  );
  if (!assert4) allPassed = false;

  console.log("============================================================");
  if (allPassed) {
    console.log("🎉 ALL 4 ASSERTIONS PASSED SUCCESSFULLY");
    console.log("============================================================\n");
    process.exit(0);
  } else {
    console.error("💥 ONE OR MORE ASSERTIONS FAILED");
    console.log("============================================================\n");
    process.exit(1);
  }
}

runSmokeTest()
  .catch((err) => {
    console.error("❌ Smoke test unhandled failure:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
