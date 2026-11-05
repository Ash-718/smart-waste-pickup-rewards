/**
 * WasteWise Sangli-Miraj Operational Ward & Area Zone Service
 * 
 * Automatically resolves and clusters municipal waste pickups by geographic
 * ward and operational sector based on address keywords and GPS coordinates.
 */

const SANGLI_WARDS = [
  // Specific sub-districts and industrial areas first
  {
    code: "WARD-KUPWAD-MIDC",
    name: "Kupwad & APMC Market Yard",
    area: "Kupwad",
    centroid: { lat: 16.862, lng: 74.628 },
    keywords: ["kupwad", "midc", "apmc", "market yard", "water tank", "phase 1", "phase 2"],
  },
  {
    code: "WARD-VISHRAMBAG",
    name: "Vishrambag & College Corner",
    area: "Vishrambag",
    centroid: { lat: 16.851, lng: 74.588 },
    keywords: [
      "vishrambag",
      "college corner",
      "willingdon",
      "chintaman nagar",
      "100ft road",
      "100 ft road",
      "chandan nagar",
      "sangli-miraj link",
    ],
  },
  {
    code: "WARD-MADHAVNAGAR",
    name: "Madhavnagar Sector",
    area: "Madhavnagar",
    centroid: { lat: 16.8605, lng: 74.603 },
    keywords: ["madhavnagar", "vasantdada", "railway crossing", "sangli-madhavnagar"],
  },
  // Core city areas next
  {
    code: "WARD-SANGLI-CENTRAL",
    name: "Sangli Gaonbhag & Khanbhag",
    area: "Sangli City",
    centroid: { lat: 16.858, lng: 74.575 },
    keywords: [
      "gaon bhag",
      "gaonbhag",
      "khanbhag",
      "ram nagar",
      "ganpati temple",
      "haripur",
      "rajwada",
      "mseb substation",
      "chhatrapati shivaji stadium",
      "sangli city",
      "sangli",
    ],
  },
  {
    code: "WARD-MIRAJ-CENTRAL",
    name: "Miraj Junction & Central",
    area: "Miraj City",
    centroid: { lat: 16.8435, lng: 74.608 },
    keywords: [
      "brahman puri",
      "gandhi chowk",
      "wanless",
      "chandanwadi",
      "civil hospital miraj",
      "mission compound",
      "high school road",
      "miraj junction",
      "station road",
      "miraj",
    ],
  },
];

/**
 * Calculates Haversine distance in kilometers between two lat/lng coordinates.
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999999;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolves the operational ward/area for a pickup from address text or coordinates.
 */
function resolvePickupWard(pickup) {
  if (!pickup) {
    return {
      code: "WARD-GENERAL",
      name: "General Sector",
      area: "General Ward",
    };
  }

  const address = (pickup.address || "").toLowerCase();
  const lat = pickup.latitude;
  const lng = pickup.longitude;

  // 1. Text-based keyword match on address
  for (const ward of SANGLI_WARDS) {
    for (const kw of ward.keywords) {
      if (address.includes(kw)) {
        return {
          code: ward.code,
          name: ward.name,
          area: ward.area,
        };
      }
    }
  }

  // 2. Nearest centroid match if coordinates exist
  if (lat != null && lng != null) {
    let bestWard = null;
    let minDistance = Infinity;

    for (const ward of SANGLI_WARDS) {
      const dist = calculateHaversineKm(lat, lng, ward.centroid.lat, ward.centroid.lng);
      if (dist < minDistance) {
        minDistance = dist;
        bestWard = ward;
      }
    }

    // If within 10km of Sangli cluster centroid
    if (bestWard && minDistance <= 10) {
      return {
        code: bestWard.code,
        name: bestWard.name,
        area: bestWard.area,
      };
    }
  }

  // 3. Fallback for test/out-of-area locations (e.g. Pune / Mumbai)
  const cityMatch = address.match(/(pune|mumbai|kothrud|andheri|colaba|sector \d+)/i);
  if (cityMatch) {
    const locality = cityMatch[0];
    const capitalized = locality.charAt(0).toUpperCase() + locality.slice(1);
    return {
      code: `WARD-${capitalized.toUpperCase().replace(/\s+/g, "-")}`,
      name: `${capitalized} Ward`,
      area: capitalized,
    };
  }

  return {
    code: "WARD-GENERAL",
    name: "General Sector",
    area: "General Ward",
  };
}

/**
 * Groups a collection of pickups into area/ward clusters.
 */
function groupPickupsByWard(pickups) {
  const clusterMap = new Map();

  for (const p of pickups) {
    const ward = resolvePickupWard(p);
    const key = `${ward.code}__${p.slotPeriod || "any"}__${p.requestedDate ? new Date(p.requestedDate).toISOString().split("T")[0] : "any"}`;

    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        clusterKey: key,
        wardCode: ward.code,
        wardName: ward.name,
        area: ward.area,
        slotPeriod: p.slotPeriod,
        requestedDate: p.requestedDate,
        pickupCount: 0,
        totalEstimatedWeight: 0,
        pickups: [],
      });
    }

    const cluster = clusterMap.get(key);
    cluster.pickupCount += 1;
    cluster.totalEstimatedWeight += p.wasteQuantity || (p.quantityBand === "LARGE" ? 15 : p.quantityBand === "MEDIUM" ? 8 : 3);
    cluster.pickups.push({
      ...p,
      ward,
    });
  }

  return Array.from(clusterMap.values()).sort((a, b) => b.pickupCount - a.pickupCount);
}

module.exports = {
  SANGLI_WARDS,
  resolvePickupWard,
  groupPickupsByWard,
  calculateHaversineKm,
};
