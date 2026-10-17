const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

// In-memory cache for ETA & route calculations (15-second TTL)
const routeCache = new Map();
const CACHE_TTL_MS = 15 * 1000;

// Earth radius in kilometers for Haversine
const EARTH_RADIUS_KM = 6371;
const DEFAULT_URBAN_SPEED_KMH = 25; // 25 km/h typical city collection speed

/**
 * Calculates straight-line Haversine distance between two points in km.
 */
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Fallback routing calculation using Haversine distance + estimated road detour factor (1.3x).
 */
function calculateFallbackRoute(origin, destination) {
  const straightDistanceKm = calculateHaversineDistanceKm(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  );
  // Real city road networks typically require ~1.3x straight-line distance
  const estimatedRoadDistanceKm = straightDistanceKm * 1.3;
  const estimatedHours = estimatedRoadDistanceKm / DEFAULT_URBAN_SPEED_KMH;
  const durationSeconds = Math.max(60, Math.round(estimatedHours * 3600));

  return {
    source: "haversine_fallback",
    distanceMeters: Math.round(estimatedRoadDistanceKm * 1000),
    distanceKm: parseFloat(estimatedRoadDistanceKm.toFixed(2)),
    durationSeconds,
    durationMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
    geometry: [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ],
  };
}

/**
 * Generates a cache key by rounding coordinates to 4 decimal places (~11 meters resolution).
 */
function getCacheKey(origin, destination) {
  return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
}

/**
 * Fetches route and ETA from OSRM with caching and graceful Haversine fallback.
 * 
 * @param {Object} origin { lat: number, lng: number }
 * @param {Object} destination { lat: number, lng: number }
 * @returns {Promise<Object>} { distanceMeters, distanceKm, durationSeconds, durationMinutes, geometry, source }
 */
async function getRouteAndEta(origin, destination) {
  if (!origin || !origin.lat || !origin.lng || !destination || !destination.lat || !destination.lng) {
    return null;
  }

  // 1. Check in-memory cache
  const cacheKey = getCacheKey(origin, destination);
  const cached = routeCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Query OSRM API (timeout at 3000ms so clients are never blocked)
  try {
    const url = `${OSRM_BASE_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSRM responded with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error("No route found by OSRM");
    }

    const route = data.routes[0];
    const distanceMeters = Math.round(route.distance);
    const durationSeconds = Math.round(route.duration);

    // OSRM geojson coordinates are [lng, lat], convert to [lat, lng] for frontend maps
    const geometry = (route.geometry.coordinates || []).map(([lng, lat]) => [lat, lng]);

    const result = {
      source: "osrm",
      distanceMeters,
      distanceKm: parseFloat((distanceMeters / 1000).toFixed(2)),
      durationSeconds,
      durationMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
      geometry,
    };

    // Cache result
    routeCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  } catch (err) {
    console.warn(`[RoutingService] OSRM call failed (${err.message}). Using Haversine fallback.`);
    const fallbackResult = calculateFallbackRoute(origin, destination);
    routeCache.set(cacheKey, { timestamp: now, data: fallbackResult });
    return fallbackResult;
  }
}

module.exports = {
  getRouteAndEta,
  calculateHaversineDistanceKm,
};
