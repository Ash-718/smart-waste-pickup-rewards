const prisma = require("../db/client");
const { getIO, broadcastPickupStatus } = require("../socket");
const { getRouteAndEta } = require("./routingService");

// Map of active simulation timers by pickupId
const activeSimulations = new Map();

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates.
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
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
 * Builds cumulative distance array along polyline waypoints.
 */
function buildCumulativeDistances(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const d = calculateDistanceMeters(
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
    const heading =
      points.length > 1
        ? calculateBearing(points[0][0], points[0][1], points[1][0], points[1][1])
        : 0;
    return { lat: points[0][0], lng: points[0][1], heading };
  }
  if (distMeters >= total) {
    const last = points.length - 1;
    const heading =
      points.length > 1
        ? calculateBearing(
            points[last - 1][0],
            points[last - 1][1],
            points[last][0],
            points[last][1]
          )
        : 0;
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
 * Starts virtual driver simulation for a given pickupId.
 */
async function startSimulation(pickupId, options = {}) {
  // If already running, return status
  if (activeSimulations.has(pickupId)) {
    return {
      success: true,
      alreadyRunning: true,
      message: "Virtual GPS simulation is already active for this pickup.",
    };
  }

  // 1. Fetch pickup with assignment & vehicle
  let pickup = await prisma.pickup.findUnique({
    where: { id: pickupId },
    include: {
      assignments: {
        where: { isActive: true },
        take: 1,
        include: {
          vehicle: {
            include: { driver: true },
          },
        },
      },
    },
  });

  if (!pickup) {
    throw new Error(`Pickup ${pickupId} not found`);
  }

  // 2. Ensure an active assignment and vehicle exist
  let vehicle = pickup.assignments[0]?.vehicle;
  let driver = vehicle?.driver;

  if (!vehicle) {
    // Find an active vehicle to assign
    vehicle = await prisma.vehicle.findFirst({
      where: { isActive: true },
      include: { driver: true },
    });

    if (!vehicle) {
      throw new Error("No active vehicles available to simulate");
    }
    driver = vehicle.driver;

    // Create assignment and link pickup
    await prisma.vehicleAssignment.create({
      data: {
        vehicleId: vehicle.id,
        pickupId: pickup.id,
        isActive: true,
        assignedAt: new Date(),
      },
    });
  }

  // 3. Ensure status is "on_the_way" so tracking is live
  if (pickup.status === "requested" || pickup.status === "assigned") {
    await prisma.pickup.update({
      where: { id: pickup.id },
      data: { status: "on_the_way" },
    });
    broadcastPickupStatus(pickup.id, "on_the_way");
  }

  // 4. Determine destination and starting points
  const destLat = pickup.latitude || 16.8413;
  const destLng = pickup.longitude || 74.6016;

  // Hub coordinates (Central Sorting & Recycling Hub, Miraj)
  const HUB_LAT = 16.8580;
  const HUB_LNG = 74.6150;

  let startLat = vehicle.currentLat || HUB_LAT;
  let startLng = vehicle.currentLng || HUB_LNG;

  // If vehicle is already at the destination, start from hub to give a realistic trip
  if (calculateDistanceMeters(startLat, startLng, destLat, destLng) < 150) {
    startLat = HUB_LAT;
    startLng = HUB_LNG;
  }

  // 5. Fetch road route geometry
  const origin = { lat: startLat, lng: startLng };
  const destination = { lat: destLat, lng: destLng };
  const routeData = await getRouteAndEta(origin, destination);

  let waypoints = routeData?.geometry || [];

  // If route only has 2 points, smooth with intermediate steps
  if (waypoints.length <= 2) {
    const steps = 30;
    waypoints = [];
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      waypoints.push([
        parseFloat((startLat + (destLat - startLat) * frac).toFixed(6)),
        parseFloat((startLng + (destLng - startLng) * frac).toFixed(6)),
      ]);
    }
  }

  const cumDistances = buildCumulativeDistances(waypoints);
  const totalMeters = cumDistances[cumDistances.length - 1];

  // Simulation settings
  const speedKmh = options.speedKmh || 30; // 30 km/h
  const intervalSeconds = 3;
  const intervalMs = intervalSeconds * 1000;
  const metersPerStep = ((speedKmh * 1000) / 3600) * intervalSeconds; // ~25 meters per step

  let currentDistMeters = 0;
  let elapsedSec = 0;

  console.log(`[Virtual GPS] Started simulation for pickup #${pickup.id.slice(0, 8)} (${(totalMeters / 1000).toFixed(2)} km, vehicle: ${vehicle.registrationNo})`);

  // Interval routine
  const intervalId = setInterval(async () => {
    try {
      currentDistMeters += metersPerStep;
      elapsedSec += intervalSeconds;

      const currentPos = interpolateAtDistance(waypoints, cumDistances, currentDistMeters);
      const distToDest = calculateDistanceMeters(currentPos.lat, currentPos.lng, destLat, destLng);
      const recordedAt = new Date();

      // 1. Update vehicle record in database
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          currentLat: currentPos.lat,
          currentLng: currentPos.lng,
          currentSpeed: Math.round(speedKmh),
          currentHeading: currentPos.heading,
          lastLocationAt: recordedAt,
        },
      });

      // 2. Broadcast live vehicle location over Socket.IO
      const io = getIO();
      if (io) {
        const telemetryPayload = {
          pickupId: pickup.id,
          vehicleId: vehicle.id,
          registrationNo: vehicle.registrationNo,
          driverId: driver?.id || null,
          driverName: driver?.name || "WasteWise Driver",
          lat: currentPos.lat,
          lng: currentPos.lng,
          speed: Math.round(speedKmh),
          heading: currentPos.heading,
          recordedAt: recordedAt.toISOString(),
          serverTime: recordedAt.toISOString(),
        };

        io.to(`pickup:${pickup.id}`).emit("vehicle:location", telemetryPayload);
        io.to("fleet:live").emit("fleet:vehicle_location", telemetryPayload);
      }

      // Check arrival condition (within 35 meters or end of route)
      if (currentDistMeters >= totalMeters || distToDest <= 35) {
        console.log(`[Virtual GPS] Pickup #${pickup.id.slice(0, 8)} vehicle arrived at destination.`);
        stopSimulation(pickup.id);

        // Update pickup to "arrived"
        await prisma.pickup.update({
          where: { id: pickup.id },
          data: { status: "arrived" },
        });
        broadcastPickupStatus(pickup.id, "arrived");
      }
    } catch (err) {
      console.error(`[Virtual GPS] Error in simulation loop for pickup ${pickup.id}:`, err.message);
    }
  }, intervalMs);

  activeSimulations.set(pickup.id, {
    intervalId,
    vehicleId: vehicle.id,
    registrationNo: vehicle.registrationNo,
    startTime: Date.now(),
  });

  // Emit immediate first packet so screen updates instantly
  const initialPos = interpolateAtDistance(waypoints, cumDistances, 0);
  const now = new Date();
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      currentLat: initialPos.lat,
      currentLng: initialPos.lng,
      currentSpeed: Math.round(speedKmh),
      currentHeading: initialPos.heading,
      lastLocationAt: now,
    },
  });

  const io = getIO();
  if (io) {
    const immediatePayload = {
      pickupId: pickup.id,
      vehicleId: vehicle.id,
      registrationNo: vehicle.registrationNo,
      driverId: driver?.id || null,
      driverName: driver?.name || "WasteWise Driver",
      lat: initialPos.lat,
      lng: initialPos.lng,
      speed: Math.round(speedKmh),
      heading: initialPos.heading,
      recordedAt: now.toISOString(),
      serverTime: now.toISOString(),
    };
    io.to(`pickup:${pickup.id}`).emit("vehicle:location", immediatePayload);
    io.to("fleet:live").emit("fleet:vehicle_location", immediatePayload);
  }

  return {
    success: true,
    message: "Virtual GPS simulation started",
    vehicle: vehicle.registrationNo,
    totalDistanceMeters: totalMeters,
  };
}

/**
 * Stops simulation for a given pickupId.
 */
function stopSimulation(pickupId) {
  const sim = activeSimulations.get(pickupId);
  if (sim) {
    clearInterval(sim.intervalId);
    activeSimulations.delete(pickupId);
    console.log(`[Virtual GPS] Stopped simulation for pickup #${pickupId.slice(0, 8)}`);
    return { success: true, message: "Simulation stopped" };
  }
  return { success: true, message: "No active simulation found for this pickup" };
}

/**
 * Checks whether simulation is running for a pickupId.
 */
function isSimulationActive(pickupId) {
  return activeSimulations.has(pickupId);
}

module.exports = {
  startSimulation,
  stopSimulation,
  isSimulationActive,
};

