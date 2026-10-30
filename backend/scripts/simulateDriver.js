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
//           --stop-at-meters=<meters>, --auto-arrive, --email=<email>, --password=<pwd>, --multi
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith("--")) {
    const [key, val] = arg.slice(2).split("=");
    acc[key] = val !== undefined ? val : true;
  }
  return acc;
}, {});

const IS_MULTI_MODE = Boolean(args.multi);
const IS_LOOP_MODE = Boolean(args.loop);
const TARGET_PICKUP_ID = args.pickup || args.pickupId || null;
const DRIVER_EMAIL = args.email || process.env.DEMO_COLLECTOR_EMAIL || "demo_collector@example.com";
const DRIVER_PASSWORD = args.password || process.env.DEMO_COLLECTOR_PASSWORD || "DemoCollector@123";
const SPEED_MULTIPLIER = Math.max(0.1, parseFloat(args.speed || "1"));
const BASE_SPEED_KMH = parseFloat(process.env.DEMO_SPEED_KMH || demoConfig.speedKmh || "30");
const EFFECTIVE_SPEED_KMH = BASE_SPEED_KMH * SPEED_MULTIPLIER;
const INTERVAL_SECONDS = 3; // Emits every 3s while moving (matches server rate-limit)
const INTERVAL_MS = INTERVAL_SECONDS * 1000;
const HEARTBEAT_SECONDS = 5; // Emits every 5s while stopped (keeps vehicle fresh under 30s threshold)

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
async function fetchRoadRoute(startLat, startLng, destLat, destLng, tag = "") {
  const prefix = tag ? `[${tag}] ` : "";
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
    console.log(`${prefix}✓ Fetched OSRM road route: ${(route.distance / 1000).toFixed(2)} km, ${coords.length} waypoints.`);
    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      coordinates: coords,
      source: "osrm_live",
    };
  } catch (err) {
    console.warn(`${prefix}[SIMULATION NOTE] Using fallback route (${err.message}).`);
    const cachedPath = path.join(__dirname, "demo-route.json");
    if (fs.existsSync(cachedPath)) {
      const cached = JSON.parse(fs.readFileSync(cachedPath, "utf-8"));
      const lastCoord = cached.coordinates?.[cached.coordinates.length - 1];
      if (lastCoord && calculateHaversineMeters(lastCoord[0], lastCoord[1], destLat, destLng) < 800) {
        return {
          distanceMeters: cached.distanceMeters,
          durationSeconds: cached.durationSeconds,
          coordinates: cached.coordinates,
          source: "cached_fallback",
        };
      }
    }
    // Smooth multi-step linear fallback for arbitrary destinations
    const steps = 40;
    const coords = [];
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      coords.push([
        parseFloat((startLat + (destLat - startLat) * frac).toFixed(6)),
        parseFloat((startLng + (destLng - startLng) * frac).toFixed(6)),
      ]);
    }
    const dist = calculateHaversineMeters(startLat, startLng, destLat, destLng);
    return {
      distanceMeters: dist,
      durationSeconds: Math.round(dist / 10),
      coordinates: coords,
      source: "interpolated_linear_fallback",
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

/**
 * Executes the live driving routine for a single collector.
 */
async function simulateCollectorDriver({
  driverEmail,
  driverPassword,
  pickupId = null,
  speedMultiplier = SPEED_MULTIPLIER,
  autoArrive = AUTO_ARRIVE,
  gpsLossAt = GPS_LOSS_AT,
  gpsLossFor = GPS_LOSS_FOR,
  stopAtMeters = STOP_AT_METERS,
  tag = "DRIVER",
}) {
  const logPrefix = `[${tag}]`;
  console.log(`${logPrefix} Authenticating via REST as ${driverEmail}...`);

  // 1. Driver REST Login
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: driverEmail, password: driverPassword }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.json();
    throw new Error(`${logPrefix} Login failed (${loginRes.status}): ${JSON.stringify(err)}`);
  }

  const { token, user } = await loginRes.json();
  const driverHeaders = { Authorization: `Bearer ${token}` };
  console.log(`${logPrefix} ✓ Authenticated: ${user.name} (Role: ${user.role})`);

  // 2. Fetch driver's active assigned pickups
  const jobsRes = await fetch(`${API_BASE}/driver/pickups`, { headers: driverHeaders });
  const jobsData = await jobsRes.json();

  if (!jobsData.pickups || jobsData.pickups.length === 0) {
    throw new Error(
      `${logPrefix} No active pickups assigned to driver "${user.name}". Run 'npm run demo:seed' first.`
    );
  }

  const targetPickup = pickupId
    ? jobsData.pickups.find((p) => p.id === pickupId)
    : jobsData.pickups[0];

  if (!targetPickup) {
    throw new Error(`${logPrefix} Pickup with ID ${pickupId} not found in driver's assigned jobs.`);
  }

  const vehicleReg = jobsData.vehicle?.registrationNo || "Vehicle";
  console.log(`${logPrefix} ✓ Target pickup: #${targetPickup.id.slice(0, 8)} (${targetPickup.wasteType}) on ${vehicleReg}`);
  console.log(`${logPrefix}   Destination: ${targetPickup.address}`);

  // 3. Connect to Socket.IO with JWT Handshake
  console.log(`${logPrefix} Connecting to Socket.IO server at ${SOCKET_BASE}...`);
  const socket = io(SOCKET_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${logPrefix} Socket connection timeout`)), 10000);
    socket.on("connect", () => {
      clearTimeout(timeout);
      console.log(`${logPrefix} ✓ Connected to Socket.IO (Socket ID: ${socket.id})`);
      resolve();
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`${logPrefix} Socket connection error: ${err.message}`));
    });
  });

  // Join pickup room for tracking
  socket.emit("join:pickup", { pickupId: targetPickup.id }, (res) => {
    console.log(`${logPrefix} ✓ Joined room for pickup (#${targetPickup.id.slice(0, 8)}):`, res);
  });

  // 4. Start trip transition (on_the_way)
  if (targetPickup.status === "assigned") {
    console.log(`${logPrefix} Transitioning pickup to 'on_the_way' (trip started)...`);
    const patchRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
      method: "PATCH",
      headers: { ...driverHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "on_the_way" }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.json();
      throw new Error(`${logPrefix} Failed to start trip: ${JSON.stringify(err)}`);
    }
    console.log(`${logPrefix} ✓ Pickup transitioned to 'on_the_way' via server status API.`);
  } else {
    console.log(`${logPrefix} ℹ Pickup already in progress (${targetPickup.status}). Continuing simulation.`);
  }

  // 5. Fetch road route and prepare constant speed interpolation
  const destLat = targetPickup.latitude || demoConfig.destination.lat;
  const destLng = targetPickup.longitude || demoConfig.destination.lng;
  const startLat = jobsData.vehicle?.currentLat || demoConfig.start.lat;
  const startLng = jobsData.vehicle?.currentLng || demoConfig.start.lng;

  const routeData = await fetchRoadRoute(startLat, startLng, destLat, destLng, tag);
  const waypoints = routeData.coordinates;
  const cumDistances = buildCumulativeDistances(waypoints);
  const totalRouteMeters = cumDistances[cumDistances.length - 1];

  const targetStopDistMeters = findStopDistanceAlongRoute(waypoints, cumDistances, stopAtMeters, destLat, destLng);

  console.log(`${logPrefix} Driving along route: ${(totalRouteMeters / 1000).toFixed(2)} km total (Stop at ~${stopAtMeters}m from dest)`);

  const effectiveSpeedKmh = BASE_SPEED_KMH * speedMultiplier;
  const metersPerSec = (effectiveSpeedKmh * 1000) / 3600;
  const metersPerStep = metersPerSec * INTERVAL_SECONDS;

  let activeWaypoints = waypoints;
  let activeCumDistances = cumDistances;
  let activeTotalMeters = totalRouteMeters;
  let activeStopDist = targetStopDistMeters;
  let activeDestLat = destLat;
  let activeDestLng = destLng;

  let continueRunning = true;
  let finalTelemetry = null;
  let elapsedSec = 0;
  let finalDistFromDest = 999999;

  while (continueRunning) {
    let currentDistMeters = 0;
    while (currentDistMeters < activeStopDist) {
      const inGpsLoss =
        gpsLossAt !== null &&
        gpsLossFor !== null &&
        elapsedSec >= gpsLossAt &&
        elapsedSec < gpsLossAt + gpsLossFor;

      const currentPos = interpolateAtDistance(activeWaypoints, activeCumDistances, currentDistMeters);
      finalDistFromDest = calculateHaversineMeters(currentPos.lat, currentPos.lng, activeDestLat, activeDestLng);

      if (inGpsLoss) {
        const remainingLoss = Math.round(gpsLossAt + gpsLossFor - elapsedSec);
        console.log(`${logPrefix} [T+${elapsedSec}s] ⚠️ [GPS LOSS] Signal suppressed (${remainingLoss}s remaining).`);
      } else {
        const telemetry = {
          lat: currentPos.lat,
          lng: currentPos.lng,
          speed: Math.round(BASE_SPEED_KMH),
          heading: currentPos.heading,
        };

        socket.emit("driver:location", telemetry, (ack) => {
          if (ack?.error) {
            console.error(`${logPrefix} [Socket Ack Error]:`, ack.error);
          }
        });

        const progressPct = Math.min(100, Math.round((currentDistMeters / activeTotalMeters) * 100));
        console.log(
          `${logPrefix} [T+${elapsedSec}s] (${progressPct}%) -> (${telemetry.lat.toFixed(5)}, ${telemetry.lng.toFixed(5)}) • ${telemetry.speed} km/h • Head: ${telemetry.heading}° • Dist: ${finalDistFromDest}m`
        );
      }

      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      currentDistMeters += metersPerStep;
      elapsedSec += INTERVAL_SECONDS;
    }

    // Final stop point for this leg
    currentDistMeters = activeStopDist;
    const finalPos = interpolateAtDistance(activeWaypoints, activeCumDistances, currentDistMeters);
    finalDistFromDest = calculateHaversineMeters(finalPos.lat, finalPos.lng, activeDestLat, activeDestLng);
    console.log(`\n${logPrefix} 📍 Waypoint reached: (${finalPos.lat.toFixed(5)}, ${finalPos.lng.toFixed(5)}) - ~${finalDistFromDest}m to leg target.`);

    await new Promise((r) => setTimeout(r, 3100));
    finalTelemetry = {
      lat: finalPos.lat,
      lng: finalPos.lng,
      speed: 0,
      heading: finalPos.heading,
    };
    await new Promise((resolve) => {
      socket.emit("driver:location", finalTelemetry, (ack) => resolve(ack));
    });

    if (autoArrive) {
      continueRunning = false;
    } else if (IS_LOOP_MODE) {
      console.log(`${logPrefix} 🔄 [LOOP MODE] Reversing waypoints to maintain live fleet movement...`);
      activeWaypoints = [...activeWaypoints].reverse();
      activeCumDistances = buildCumulativeDistances(activeWaypoints);
      activeTotalMeters = activeCumDistances[activeCumDistances.length - 1];
      const newDest = activeWaypoints[activeWaypoints.length - 1];
      activeDestLat = newDest[0];
      activeDestLng = newDest[1];
      activeStopDist = findStopDistanceAlongRoute(activeWaypoints, activeCumDistances, stopAtMeters, activeDestLat, activeDestLng);
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      continueRunning = false;
    }
  }

  // 6. Arrival & Completion
  if (autoArrive) {
    console.log(`${logPrefix} Auto-arrive enabled: Calling real server PATCH arrived endpoint...`);
    const arrivedRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
      method: "PATCH",
      headers: { ...driverHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "arrived" }),
    });

    const arrivedBody = await arrivedRes.json();
    console.log(`${logPrefix} Arrival Response [${arrivedRes.status}]:`, arrivedBody.pickup?.status || arrivedBody.error);

    if (arrivedRes.ok) {
      console.log(`${logPrefix} ✓ Successfully marked arrived! Simulating scale measurement (3s)...`);
      await new Promise((r) => setTimeout(r, 3000));

      console.log(`${logPrefix} 🎉 Calling real server PATCH completed endpoint with measured weight (5.0 kg)...`);
      const completeRes = await fetch(`${API_BASE}/driver/pickups/${targetPickup.id}/status`, {
        method: "PATCH",
        headers: { ...driverHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", wasteQuantity: 5.0 }),
      });

      const completeBody = await completeRes.json();
      console.log(`${logPrefix} ✅ Pickup Completed! Points Awarded: +${completeBody.pointsEarned || 25} Green Points`);
    } else {
      console.log(`${logPrefix} ℹ Arrival check rejected as expected by server geofence or stale check.`);
    }

    socket.disconnect();
    return { success: true, vehicleReg };
  } else {
    console.log(`${logPrefix} Transmitting stationary heartbeats every ${HEARTBEAT_SECONDS}s. Press Ctrl+C to terminate.`);
    const heartbeat = setInterval(() => {
      socket.emit("driver:location", finalTelemetry);
    }, HEARTBEAT_SECONDS * 1000);

    return new Promise((resolve) => {
      process.on("SIGINT", () => {
        clearInterval(heartbeat);
        socket.disconnect();
        console.log(`${logPrefix} Disconnected.`);
        resolve({ terminated: true });
      });
    });
  }
}

/**
 * Main simulation runner: Supports Single-Driver and Multi-Driver concurrent modes.
 */
async function main() {
  console.log("================================================================================");
  console.log(`🚛 [SIMULATED DEMO] WasteWise Live Fleet Simulator (${IS_MULTI_MODE ? "MULTI-VEHICLE FLEET MODE" : "SINGLE VEHICLE MODE"})`);
  console.log("================================================================================");
  console.log(`Speed Config:     Multiplier ${SPEED_MULTIPLIER}x (Effective speed: ${EFFECTIVE_SPEED_KMH.toFixed(1)} km/h)`);
  console.log(`Telemetry Rates:  3s moving / 10s stationary (Production rate limits respected)`);
  console.log(`Stop Condition:   Within ~${STOP_AT_METERS}m of pickup destination`);
  console.log(`Auto-Arrive:      ${AUTO_ARRIVE ? "ENABLED (Will mark arrived and completed)" : "DISABLED (Will stream stationary heartbeats)"}`);
  console.log("================================================================================\n");

  if (IS_MULTI_MODE) {
    // Multi-vehicle concurrent simulation
    // Simulates 2 distinct trucks driving concurrently to demonstrate live fleet telemetry
    const multiDrivers = [
      {
        tag: "TRUCK-01",
        driverEmail: "demo_collector@example.com",
        driverPassword: "DemoCollector@123",
      },
      {
        tag: "TRUCK-02",
        driverEmail: "demo_collector_suresh@example.com",
        driverPassword: "DemoCollector@123",
      },
    ];

    console.log(`🚀 Launching ${multiDrivers.length} concurrent simulated drivers on the road network...\n`);

    const results = await Promise.allSettled(
      multiDrivers.map((driver) =>
        simulateCollectorDriver({
          ...driver,
          speedMultiplier: SPEED_MULTIPLIER,
          autoArrive: AUTO_ARRIVE,
          stopAtMeters: STOP_AT_METERS,
        })
      )
    );

    console.log("\n================================================================================");
    console.log("🏁 [SIMULATED DEMO] Multi-Vehicle Simulation Complete!");
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const driver = multiDrivers[i];
      if (res.status === "fulfilled") {
        console.log(`  ✓ ${driver.tag} (${driver.driverEmail}): Finished successfully.`);
      } else {
        console.error(`  ❌ ${driver.tag} (${driver.driverEmail}): ${res.reason?.message || res.reason}`);
      }
    }
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    // Single-vehicle simulation (Preserves full backward compatibility)
    await simulateCollectorDriver({
      driverEmail: DRIVER_EMAIL,
      driverPassword: DRIVER_PASSWORD,
      pickupId: TARGET_PICKUP_ID,
      speedMultiplier: SPEED_MULTIPLIER,
      autoArrive: AUTO_ARRIVE,
      gpsLossAt: GPS_LOSS_AT,
      gpsLossFor: GPS_LOSS_FOR,
      stopAtMeters: STOP_AT_METERS,
      tag: "DEMO-TRUCK-01",
    });
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\n❌ Simulator Error:", err.message);
  process.exit(1);
});
