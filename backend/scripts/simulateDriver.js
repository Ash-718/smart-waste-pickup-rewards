require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { io } = require("socket.io-client");
const demoConfig = require("./demo.config.json");

// Production safeguard
if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_SIMULATION) {
  console.error("❌ Refusing to run simulation in production environment.");
  process.exit(1);
}

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:4000/api";
const SOCKET_BASE = process.env.SOCKET_BASE_URL || "http://127.0.0.1:4000";
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

// CLI Arguments parsing
// Supports: --pickup=<id>, --speed=<multiplier>, --gps-loss-at=<sec>, --gps-loss-for=<sec>,
//           --stop-at-meters=<meters>, --auto-arrive, --email=<email>, --password=<pwd>
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    acc[key] = val !== undefined ? val : true;
  }
  return acc;
}, {});

const TARGET_PICKUP_ID = args.pickup || args.pickupId || null;
const DRIVER_EMAIL = args.email || process.env.DEMO_COLLECTOR_EMAIL || "demo_collector@example.com";
const DRIVER_PASSWORD = args.password || process.env.DEMO_COLLECTOR_PASSWORD || "DemoCollector@123";
const SPEED_MULTIPLIER = Math.max(0.1, parseFloat(args.speed || "1"));
const BASE_SPEED_KMH = parseFloat(process.env.DEMO_SPEED_KMH || demoConfig.speedKmh || "30");
const EFFECTIVE_SPEED_KMH = BASE_SPEED_KMH * SPEED_MULTIPLIER;
const INTERVAL_SECONDS = 3; // Emits every 3s while moving (matches server rate-limit)
const INTERVAL_MS = INTERVAL_SECONDS * 1000;
const HEARTBEAT_SECONDS = 10; // Emits every 10s while stopped

const GPS_LOSS_AT = args["gps-loss-at"] ? parseFloat(args["gps-loss-at"]) : null;
const GPS_LOSS_FOR = args["gps-loss-for"] ? parseFloat(args["gps-loss-for"]) : null;
const STOP_AT_METERS = args["stop-at-meters"] !== undefined ? parseFloat(args["stop-at-meters"]) : (demoConfig.defaultStopAtMeters || 250);
const AUTO_ARRIVE = Boolean(args["auto-arrive"]);

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates.
 */
function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates compass heading (bearing) between two points in degrees (0-360).
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

/**
 * Fetches real road route from OSRM or falls back to committed cached route.
 */
async function fetchRoadRoute(startLat, startLng, destLat, destLng) {
  console.log(`[SIMULATION NOTE] Requesting real road route from OSRM (${OSRM_BASE_URL})...`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const url = `${OSRM_BASE_URL}/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OSRM HTTP error status ${res.status}`);
    }

    const data = await res.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error("No route returned by OSRM");
    }

    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    console.log(`✓ Fetched OSRM road route: ${(route.distance / 1000).toFixed(2)} km, ${coords.length} waypoints.`);
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      coordinates: coords,
      source: "osrm_live",
    };
  } catch (err) {
    console.warn(`[SIMULATION NOTE] Using cached route (OSRM unavailable: ${err.message}).`);
    const cachedPath = path.join(__dirname, "demo-route.json");
    if (fs.existsSync(cachedPath)) {
      const cached = JSON.parse(fs.readFileSync(cachedPath, "utf-8"));
      return {
        distanceMeters: cached.distanceMeters,
        durationSeconds: cached.durationSeconds,
        coordinates: cached.coordinates,
        source: "cached_fallback",
      };
    }
    // Fallback: straight segment
    return {
      distanceMeters: calculateHaversineMeters(startLat, startLng, destLat, destLng),
      durationSeconds: 300,
      coordinates: [
        [startLat, startLng],
        [destLat, destLng],
      ],
      source: "haversine_direct",
    };
  }
}

/**
 * Builds cumulative distance array along polyline waypoints.
 */
function buildCumulativeDistances(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const d = calculateHaversineMeters(
      points[i - 1][0],
      points[i - 1][1],
      points[i][0],
      points[i][1]
    );
    cum.push(cum[i - 1] + d);
  }
  return cum;
}

/**
 * Interpolates a point at distance `distMeters` along the polyline.
 */
function interpolateAtDistance(points, cumDistances, distMeters) {
  const total = cumDistances[cumDistances.length - 1];
  if (distMeters <= 0) {
    const heading = points.length > 1 ? calculateBearing(points[0][0], points[0][1], points[1][0], points[1][1]) : 0;
    return { lat: points[0][0], lng: points[0][1], heading };
  }
  if (distMeters >= total) {
    const last = points.length - 1;
    const heading = points.length > 1 ? calculateBearing(points[last - 1][0], points[last - 1][1], points[last][0], points[last][1]) : 0;
    return { lat: points[last][0], lng: points[last][1], heading };
  }

  // Find segment
  let idx = 0;
  while (idx < cumDistances.length - 1 && cumDistances[idx + 1] < distMeters) {
    idx++;
  }

  const p1 = points[idx];
  const p2 = points[idx + 1];
  const segDist = cumDistances[idx + 1] - cumDistances[idx];
  const fraction = segDist > 0 ? (distMeters - cumDistances[idx]) / segDist : 0;

  const lat = p1[0] + (p2[0] - p1[0]) * fraction;
  const lng = p1[1] + (p2[1] - p1[1]) * fraction;
  const heading = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

  return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)), heading };
}

/**
 * Finds distance along route where vehicle first enters stopAtMeters from destination.
 */
function findStopDistanceAlongRoute(waypoints, cumDistances, stopAtMeters, destLat, destLng) {
  const total = cumDistances[cumDistances.length - 1];
  for (let d = 0; d <= total; d += 10) {
    const pos = interpolateAtDistance(waypoints, cumDistances, d);
    const distToDest = calculateHaversineMeters(pos.lat, pos.lng, destLat, destLng);
    if (distToDest <= stopAtMeters) {
      return d;
    }
  }
  return total;
}

async function simulate() {
  console.log("================================================================================");
  console.log("🚛 [SIMULATED DEMO] WasteWise Live Driver Simulator Starting...");
  console.log("================================================================================");
  console.log(`Driver Account:   ${DRIVER_EMAIL}`);
  console.log(`Speed Config:     ${BASE_SPEED_KMH} km/h (Multiplier: ${SPEED_MULTIPLIER}x -> Effective: ${EFFECTIVE_SPEED_KMH.toFixed(1)} km/h)`);
  console.log(`Telemetry Rates:  3s moving / 10s stationary heartbeat (respects server throttle)`);
  console.log(`Stop Condition:   Within ~${STOP_AT_METERS} m of pickup destination`);
  if (GPS_LOSS_AT !== null && GPS_LOSS_FOR !== null) {
    console.log(`GPS Loss Mode:    Pause emissions for ${GPS_LOSS_FOR}s starting at T+${GPS_LOSS_AT}s`);
  }
  console.log("================================================================================\n");

  // 1. Driver REST Login
  console.log(`[1/6] Authenticating as collector (${DRIVER_EMAIL})...`);
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
  console.log(`✓ Authenticated: ${user.name} (Role: ${user.role})`);

  // 2. Fetch driver's active assigned pickups
  console.log("[2/6] Fetching driver's assigned jobs...");
  const driverHeaders = { Authorization: `Bearer ${token}` };
  const jobsRes = await fetch(`${API_BASE}/driver/pickups`, { headers: driverHeaders });
  const jobsData = await jobsRes.json();

  if (!jobsData.pickups || jobsData.pickups.length === 0) {
    throw new Error(
      `No active pickups assigned to driver "${user.name}". Run 'npm run demo:seed' first.`
    );
  }

  const targetPickup = TARGET_PICKUP_ID
    ? jobsData.pickups.find((p) => p.id === TARGET_PICKUP_ID)
    : jobsData.pickups[0];

  if (!targetPickup) {
    throw new Error(`Pickup with ID ${TARGET_PICKUP_ID} not found in driver's assigned jobs.`);
  }

  console.log(`✓ Target pickup identified: ID ${targetPickup.id}`);
  console.log(`  Address: ${targetPickup.address}`);
  console.log(`  Current Status: ${targetPickup.status}`);
  console.log(`  Vehicle: ${jobsData.vehicle?.registrationNo || "Assigned"}`);

  // 3. Connect to Socket.IO with JWT Handshake
  console.log(`[3/6] Connecting to Socket.IO server at ${SOCKET_BASE}...`);
  const socket = io(SOCKET_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket connection timeout after 10s")), 10000);
    socket.on("connect", () => {
      clearTimeout(timeout);
      console.log(`✓ Connected to Socket.IO (Socket ID: ${socket.id})`);
      resolve();
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Socket connection error: ${err.message}`));
    });
  });

  // Join pickup room for tracking
  socket.emit("join:pickup", { pickupId: targetPickup.id }, (res) => {
    console.log(`✓ Joined room for pickup (#${targetPickup.id.slice(0, 8)}):`, res);
  });

  // 4. Start trip transition (on_the_way)
  if (targetPickup.status === "assigned") {
    console.log("[4/6] Transitioning pickup to 'on_the_way' (trip started)...");
    const patchRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
      method: "PATCH",
      headers: { ...driverHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "on_the_way" }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.json();
      throw new Error(`Failed to start trip: ${JSON.stringify(err)}`);
    }
    console.log("✓ Pickup transitioned to 'on_the_way' via server status API.");
  } else {
    console.log(`ℹ Pickup already in progress (${targetPickup.status}). Continuing simulation.`);
  }

  // 5. Fetch road route and prepare constant speed interpolation
  const destLat = targetPickup.latitude || demoConfig.destination.lat;
  const destLng = targetPickup.longitude || demoConfig.destination.lng;
  const startLat = jobsData.vehicle?.currentLat || demoConfig.start.lat;
  const startLng = jobsData.vehicle?.currentLng || demoConfig.start.lng;

  const routeData = await fetchRoadRoute(startLat, startLng, destLat, destLng);
  const waypoints = routeData.coordinates;
  const cumDistances = buildCumulativeDistances(waypoints);
  const totalRouteMeters = cumDistances[cumDistances.length - 1];

  const targetStopDistMeters = findStopDistanceAlongRoute(waypoints, cumDistances, STOP_AT_METERS, destLat, destLng);

  console.log(`\n[5/6] Driving along road route (${(totalRouteMeters / 1000).toFixed(2)} km total):`);
  console.log(`  Start: (${startLat.toFixed(4)}, ${startLng.toFixed(4)})`);
  console.log(`  Destination: (${destLat.toFixed(4)}, ${destLng.toFixed(4)})`);
  console.log(`  Stop threshold: ~${STOP_AT_METERS} m from destination (at ${(targetStopDistMeters / 1000).toFixed(2)} km along route)\n`);

  const metersPerSec = (EFFECTIVE_SPEED_KMH * 1000) / 3600;
  const metersPerStep = metersPerSec * INTERVAL_SECONDS;

  let currentDistMeters = 0;
  let elapsedSec = 0;
  let finalDistFromDest = 999999;
  let lastEmittedTelemetry = null;

  while (currentDistMeters < targetStopDistMeters) {
    // Check if in GPS loss window
    const inGpsLoss =
      GPS_LOSS_AT !== null &&
      GPS_LOSS_FOR !== null &&
      elapsedSec >= GPS_LOSS_AT &&
      elapsedSec < GPS_LOSS_AT + GPS_LOSS_FOR;

    const currentPos = interpolateAtDistance(waypoints, cumDistances, currentDistMeters);
    finalDistFromDest = calculateHaversineMeters(currentPos.lat, currentPos.lng, destLat, destLng);

    if (inGpsLoss) {
      const remainingLoss = Math.round(GPS_LOSS_AT + GPS_LOSS_FOR - elapsedSec);
      console.log(
        `  [T+${elapsedSec}s] ⚠️  [SIMULATED GPS LOSS] Signal suppressed (${remainingLoss}s remaining). No location emitted.`
      );
    } else {
      const telemetry = {
        lat: currentPos.lat,
        lng: currentPos.lng,
        speed: Math.round(BASE_SPEED_KMH),
        heading: currentPos.heading,
      };

      socket.emit("driver:location", telemetry, (ack) => {
        if (ack?.error) {
          console.error("  [Socket Ack Error]:", ack.error);
        }
      });
      lastEmittedTelemetry = telemetry;

      const progressPct = Math.min(100, Math.round((currentDistMeters / totalRouteMeters) * 100));
      console.log(
        `  [T+${elapsedSec}s] (${progressPct}%) -> Lat: ${telemetry.lat.toFixed(5)}, Lng: ${telemetry.lng.toFixed(5)}, Speed: ${telemetry.speed} km/h, Heading: ${telemetry.heading}°, Dist to Pickup: ${finalDistFromDest}m`
      );
    }

    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    currentDistMeters += metersPerStep;
    elapsedSec += INTERVAL_SECONDS;
  }

  // Clamp to exact target stop point
  currentDistMeters = targetStopDistMeters;
  const finalPos = interpolateAtDistance(waypoints, cumDistances, currentDistMeters);
  finalDistFromDest = calculateHaversineMeters(finalPos.lat, finalPos.lng, destLat, destLng);
  console.log(`\n📍 [SIMULATED DEMO] Stopped vehicle position: (${finalPos.lat.toFixed(5)}, ${finalPos.lng.toFixed(5)}).`);
  console.log(`   Distance to pickup: ~${finalDistFromDest} meters (Arrival radius threshold is 300m).`);

  const inGpsLossAtEnd =
    GPS_LOSS_AT !== null &&
    GPS_LOSS_FOR !== null &&
    elapsedSec >= GPS_LOSS_AT &&
    elapsedSec < GPS_LOSS_AT + GPS_LOSS_FOR;

  if (!inGpsLossAtEnd) {
    // Wait for the server rate-limit window to clear
    await new Promise((r) => setTimeout(r, 3100));
    const finalTelemetry = {
      lat: finalPos.lat,
      lng: finalPos.lng,
      speed: 0,
      heading: finalPos.heading,
    };
    await new Promise((resolve) => {
      socket.emit("driver:location", finalTelemetry, (ack) => {
        if (ack?.error) console.error("  [Stop Telemetry Ack Error]:", ack.error);
        resolve(ack);
      });
    });
    lastEmittedTelemetry = finalTelemetry;
  }

  // 6. Arrival & Completion handling
  if (AUTO_ARRIVE) {
    console.log("\n[6/6] Auto-arrive enabled: Calling real server PATCH arrived endpoint...");
    const arrivedRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
      method: "PATCH",
      headers: { ...driverHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "arrived" }),
    });

    const arrivedBody = await arrivedRes.json();
    console.log(`Server HTTP Response [${arrivedRes.status}]:`, JSON.stringify(arrivedBody, null, 2));

    if (arrivedRes.ok) {
      console.log("✓ Successfully marked arrived!");
      console.log("⏳ Simulating waste loading & weighing (3s)...");
      await new Promise((r) => setTimeout(r, 3000));

      console.log("🎉 Calling real server PATCH completed endpoint with waste weight (5.0 kg)...");
      const completeRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
        method: "PATCH",
        headers: { ...driverHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", wasteQuantity: 5.0 }),
      });

      const completeBody = await completeRes.json();
      console.log(`Server HTTP Response [${completeRes.status}]:`, JSON.stringify(completeBody, null, 2));

      if (completeRes.ok) {
        console.log("================================================================================");
        console.log("✅ [SIMULATED DEMO] PICKUP COMPLETED SUCCESSFULLY!");
        console.log(`   Points Awarded: +${completeBody.pointsEarned || 25} Green Points`);
        console.log("================================================================================");
      }
    } else {
      console.log(`ℹ Arrival check rejected as expected by server geofence or stale check: HTTP ${arrivedRes.status}`);
    }
    socket.disconnect();
    process.exit(0);
  } else {
    console.log(`\n[6/6] Stopped at destination (~${finalDistFromDest}m away).`);
    console.log(`Transmitting stationary heartbeat every ${HEARTBEAT_SECONDS}s. Press Ctrl+C to terminate simulator.`);
    console.log("Tip: Run with '--auto-arrive' to automatically verify arrival and record completion.\n");

    const heartbeatInterval = setInterval(() => {
      const hbTelemetry = {
        lat: finalPos.lat,
        lng: finalPos.lng,
        speed: 0,
        heading: finalPos.heading,
      };
      socket.emit("driver:location", hbTelemetry, (ack) => {
        if (ack?.error) console.error("  [Heartbeat Ack Error]:", ack.error);
      });
      console.log(`  [Heartbeat] Transmitted stationary telemetry at (${finalPos.lat.toFixed(5)}, ${finalPos.lng.toFixed(5)}) - 0 km/h`);
    }, HEARTBEAT_SECONDS * 1000);

    process.on("SIGINT", () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
      console.log("\nSimulator terminated cleanly. Socket disconnected.");
      process.exit(0);
    });
  }
}

simulate().catch((err) => {
  console.error("\n❌ Simulator Error:", err.message);
  process.exit(1);
});
