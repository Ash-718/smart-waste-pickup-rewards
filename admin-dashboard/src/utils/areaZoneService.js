/**
 * Admin Dashboard Ward & Sector Resolution Utility
 */

export const SANGLI_WARDS = [
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

export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 999999;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function resolvePickupWard(pickup) {
  if (!pickup) {
    return { code: "WARD-GENERAL", name: "General Sector", area: "General Ward" };
  }

  // If already attached by backend
  if (pickup.ward?.area) {
    return pickup.ward;
  }

  const address = (pickup.address || "").toLowerCase();
  const lat = pickup.latitude;
  const lng = pickup.longitude;

  for (const ward of SANGLI_WARDS) {
    for (const kw of ward.keywords) {
      if (address.includes(kw)) {
        return { code: ward.code, name: ward.name, area: ward.area };
      }
    }
  }

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

    if (bestWard && minDistance <= 10) {
      return { code: bestWard.code, name: bestWard.name, area: bestWard.area };
    }
  }

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

  return { code: "WARD-GENERAL", name: "General Sector", area: "General Ward" };
}
