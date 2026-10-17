require("dotenv").config();
const { io } = require("socket.io-client");

const API_BASE = process.env.API_BASE_URL || "http://localhost:4000/api";
const SOCKET_BASE = process.env.SOCKET_BASE_URL || "http://localhost:4000";

// Command line arguments parsing: Accepts --pickupId=<uuid>, --interval=<sec>, --steps=<num>
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    acc[key] = val !== undefined ? val : true;
  }
  return acc;
}, {});

if (args.pickup && !args.pickupId) {
  throw new Error("Invalid argument: Use --pickupId=<id> instead of --pickup");
}

const DRIVER_EMAIL = args.email || process.env.SIMULATE_DRIVER_EMAIL || "driver@wastewise.local";
const DRIVER_PASSWORD = args.password || process.env.SIMULATE_DRIVER_PASSWORD || "Driver@123";
const INTERVAL_MS = parseInt(args.interval || "3", 10) * 1000;
const TOTAL_STEPS = parseInt(args.steps || "12", 10);

/**
 * Calculates bearing/heading angle between two lat/lng points in degrees (0-360).
 */
function calculateHeading(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

async function simulate() {
  console.log("==================================================");
  console.log("🚛 WasteWise Live Driver Simulator Starting...");
  console.log("==================================================");

  // 1. Driver Login
  console.log(`[1/5] Logging in as driver: ${DRIVER_EMAIL}...`);
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DRIVER_EMAIL, password: DRIVER_PASSWORD }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.json();
    throw new Error(`Driver login failed (${loginRes.status}): ${JSON.stringify(err)}`);
  }

  const { token, user } = await loginRes.json();
  console.log(`✓ Driver authenticated: ${user.name} (Role: ${user.role})`);

  // 2. Fetch driver's active assigned pickups
  console.log("[2/5] Fetching driver active pickups...");
  const driverHeaders = { Authorization: `Bearer ${token}` };
  const jobsRes = await fetch(`${API_BASE}/driver/pickups`, { headers: driverHeaders });
  const jobsData = await jobsRes.json();

  if (!jobsData.pickups || jobsData.pickups.length === 0) {
    throw new Error(
      "No active pickups assigned to this driver. Assign a pickup to vehicle " +
        (jobsData.vehicle?.registrationNo || "assigned to this driver") +
        " first."
    );
  }

  const targetPickup = args.pickupId
    ? jobsData.pickups.find((p) => p.id === args.pickupId)
    : jobsData.pickups[0];

  if (!targetPickup) {
    throw new Error(`Pickup with ID ${args.pickupId} not found in driver's assigned jobs.`);
  }

  console.log(`✓ Found target pickup: ID ${targetPickup.id}`);
  console.log(`  Address: ${targetPickup.address}`);
  console.log(`  Current Status: ${targetPickup.status}`);
  console.log(`  Vehicle: ${jobsData.vehicle?.registrationNo}`);

  // 3. Connect to Socket.IO with JWT Handshake
  console.log(`[3/5] Connecting to Socket.IO server at ${SOCKET_BASE}...`);
  const socket = io(SOCKET_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  await new Promise((resolve, reject) => {
    socket.on("connect", () => {
      console.log(`✓ Socket connected successfully (Socket ID: ${socket.id})`);
      resolve();
    });
    socket.on("connect_error", (err) => {
      reject(new Error(`Socket connection error: ${err.message}`));
    });
  });

  // Join the pickup room
  socket.emit("join:pickup", { pickupId: targetPickup.id }, (res) => {
    console.log("✓ Joined room for pickup:", res);
  });

  // 4. Start trip transition (on_the_way)
  if (targetPickup.status === "assigned") {
    console.log("[4/5] Transitioning pickup to 'on_the_way' (Start Trip)...");
    const patchRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
      method: "PATCH",
      headers: { ...driverHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "on_the_way" }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.json();
      throw new Error(`Failed to start trip: ${JSON.stringify(err)}`);
    }
    console.log("✓ Pickup transitioned to 'on_the_way'!");
  } else {
    console.log(`ℹ Pickup already in progress (Status: ${targetPickup.status}). Resuming simulation.`);
  }

  // 5. Waypoints Interpolation from Vehicle Location to Pickup Location
  const startLat = jobsData.vehicle.currentLat || 19.0657;
  const startLng = jobsData.vehicle.currentLng || 72.8687;
  const destLat = targetPickup.latitude || 19.0544;
  const destLng = targetPickup.longitude || 72.8402;

  console.log(`\n[5/5] Emitting live vehicle movement every ${INTERVAL_MS / 1000}s along route:`);
  console.log(`  Start: (${startLat.toFixed(4)}, ${startLng.toFixed(4)})`);
  console.log(`  Destination: (${destLat.toFixed(4)}, ${destLng.toFixed(4)})`);
  console.log(`  Total Steps: ${TOTAL_STEPS}\n`);

  for (let step = 1; step <= TOTAL_STEPS; step++) {
    const fraction = step / TOTAL_STEPS;
    // Add slight natural jitter to avoid perfectly straight mathematical line
    const jitterLat = (Math.random() - 0.5) * 0.0003;
    const jitterLng = (Math.random() - 0.5) * 0.0003;

    const lat = parseFloat((startLat + (destLat - startLat) * fraction + jitterLat).toFixed(6));
    const lng = parseFloat((startLng + (destLng - startLng) * fraction + jitterLng).toFixed(6));
    const speed = step === TOTAL_STEPS ? 0 : Math.round(20 + Math.random() * 15);
    const heading = calculateHeading(startLat, startLng, destLat, destLng);

    const telemetry = { lat, lng, speed, heading };

    socket.emit("driver:location", telemetry, (ack) => {
      if (ack?.error) console.error("  [Socket Ack Error]:", ack.error);
    });

    const progressPct = Math.round(fraction * 100);
    console.log(
      `  [Step ${step}/${TOTAL_STEPS}] (${progressPct}%) -> Lat: ${lat}, Lng: ${lng}, Speed: ${speed} km/h, Heading: ${heading}°`
    );

    if (step < TOTAL_STEPS) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  // 6. Arrived at pickup location
  console.log("\n📍 Vehicle arrived at citizen location! Transitioning to 'arrived'...");
  const arrivedRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
    method: "PATCH",
    headers: { ...driverHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "arrived" }),
  });
  if (arrivedRes.ok) {
    console.log("✓ Pickup transitioned to 'arrived'!");
  }

  // Pause simulating waste collection & weighing (4 seconds)
  console.log("⏳ Simulating waste loading, segregation & weighing (4s)...");
  await new Promise((r) => setTimeout(r, 4000));

  // 7. Complete Pickup & Award Points
  if (args.complete !== "false") {
    console.log("🎉 Completing pickup and awarding Green Points...");
    const completeRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
      method: "PATCH",
      headers: { ...driverHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", wasteQuantity: 5.0 }),
    });

    if (completeRes.ok) {
      const completeData = await completeRes.json();
      console.log("==================================================");
      console.log("✅ PICKUP COMPLETED SUCCESSFULLY!");
      console.log(`   Points Awarded: +${completeData.pointsEarned || 25} Green Points`);
      if (completeData.newBadges?.length) {
        console.log(`   New Badges Unlocked: ${completeData.newBadges.join(", ")}`);
      }
      console.log("==================================================");
    } else {
      const err = await completeRes.json();
      console.error("Completion error:", err);
    }
  }

  socket.disconnect();
  console.log("\nSimulator finished cleanly. Socket disconnected.");
  process.exit(0);
}

simulate().catch((err) => {
  console.error("\n❌ Simulator Error:", err.message);
  process.exit(1);
});
