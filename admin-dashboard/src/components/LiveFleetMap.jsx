import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default Leaflet icon path resolution issues in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function createPickupDestinationIcon() {
  const html = `
    <div style="width: 28px; height: 34px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 3px 4px rgba(0,0,0,0.3));">
      <svg width="28" height="34" viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.716 0 0 6.716 0 15C0 24 13.5 34.5 15 35.5C16.5 34.5 30 24 30 15C30 6.716 23.284 0 15 0Z" fill="#DC2626"/>
        <circle cx="15" cy="14" r="5" fill="#FFFFFF"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: "pickup-destination-marker",
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -32],
  });
}

/**
 * Creates a custom SVG DivIcon for live vehicles with rotation based on heading.
 */
function createVehicleIcon(vehicle, isSelected) {
  const isStale = vehicle.location?.isStale;
  const heading = vehicle.location?.heading || 0;
  const speed = vehicle.location?.speed || 0;

  const strokeColor = isSelected
    ? "#2563eb" // Blue for selected
    : isStale
    ? "#9ca3af" // Grey for stale
    : "#16a34a"; // Green for active

  const bgColor = isSelected
    ? "#dbeafe"
    : isStale
    ? "#f3f4f6"
    : "#dcfce7";

  const html = `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      ${
        !isStale && speed > 0
          ? `<div style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background: rgba(22, 163, 74, 0.25); border: 1.5px solid #16a34a; animation: pulse 2s infinite;"></div>`
          : ""
      }
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background-color: ${bgColor};
        border: 2px solid ${strokeColor};
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading}deg);
        transition: transform 0.6s ease;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
        </svg>
      </div>
      <div style="
        position: absolute;
        bottom: -18px;
        background: #111827;
        color: #ffffff;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        white-space: nowrap;
        border: 1px solid #374151;
        letter-spacing: 0.5px;
      ">
        ${vehicle.registrationNo}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "vehicle-custom-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  });
}

/**
 * Controller component to smoothly pan/zoom map to selected vehicle coordinates.
 */
function MapCenterController({ selectedCoords }) {
  const map = useMap();

  useEffect(() => {
    if (selectedCoords && selectedCoords.lat && selectedCoords.lng) {
      map.flyTo([selectedCoords.lat, selectedCoords.lng], 15, {
        duration: 1.2,
      });
    }
  }, [selectedCoords, map]);

  return null;
}

export default function LiveFleetMap({ vehicles = [], selectedVehicleId, onSelectVehicle, isDemoMode = false }) {
  const defaultCenter = [16.8580, 74.6150]; // Default to Sangli / Miraj Operations Zone
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedCoords = selectedVehicle?.location?.lat
    ? { lat: selectedVehicle.location.lat, lng: selectedVehicle.location.lng }
    : null;

  const activePickup = selectedVehicle?.activePickups?.[0];
  const pickupLat = activePickup?.latitude;
  const pickupLng = activePickup?.longitude;
  const hasPickupCoords = typeof pickupLat === "number" && typeof pickupLng === "number";

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full z-0 rounded-2xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapCenterController selectedCoords={selectedCoords} />

        {/* Demo Mode: 300m arrival radius zone around destination of selected vehicle's active pickup */}
        {isDemoMode && hasPickupCoords && (
          <>
            <Circle
              center={[pickupLat, pickupLng]}
              radius={300}
              pathOptions={{
                color: "#059669",
                fillColor: "#10b981",
                fillOpacity: 0.15,
                weight: 2,
                dashArray: "6, 6",
              }}
            />
            <Marker
              position={[pickupLat, pickupLng]}
              icon={createPickupDestinationIcon()}
            >
              <Popup>
                <div className="p-1 min-w-[180px]">
                  <div className="font-bold text-xs text-neutral-900 border-b pb-1 mb-1">
                    Pickup Destination
                  </div>
                  <div className="text-[11px] text-neutral-600 space-y-0.5">
                    <div className="font-medium text-neutral-800">{activePickup.address}</div>
                    {activePickup.citizenName && (
                      <div>Citizen: <span className="font-semibold">{activePickup.citizenName}</span></div>
                    )}
                    <div className="text-emerald-700 font-semibold text-[10px] pt-1">
                      🎯 300m Arrival Radius (Demo Zone)
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {vehicles.map((v) => {
          if (!v.location || typeof v.location.lat !== "number" || typeof v.location.lng !== "number") {
            return null;
          }

          const isSelected = v.id === selectedVehicleId;
          const icon = createVehicleIcon(v, isSelected);

          return (
            <Marker
              key={v.id}
              position={[v.location.lat, v.location.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectVehicle?.(v.id),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <span className="font-bold text-neutral-900 text-sm">{v.registrationNo}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        v.location.isStale
                          ? "bg-neutral-100 text-neutral-600"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {v.location.isStale ? "Stale (>30s)" : "Active"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-600">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Driver:</span>
                      <span className="font-semibold text-neutral-900">{v.driver?.name || "Unassigned"}</span>
                    </div>
                    {v.driver?.phone && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Phone:</span>
                        <span className="text-neutral-800">{v.driver.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Speed:</span>
                      <span className="font-semibold text-neutral-800">{v.location.speed || 0} km/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Capacity:</span>
                      <span>{v.capacity} kg ({v.type})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Active Jobs:</span>
                      <span className="font-bold text-emerald-700">{v.activePickups?.length || 0}</span>
                    </div>

                    {v.activePickups?.length > 0 && (
                      <div className="mt-2 pt-2 border-t text-[11px]">
                        <span className="font-semibold text-neutral-700 block mb-1">Current Assignment:</span>
                        <span className="text-neutral-900 font-medium block truncate">
                          {v.activePickups[0].address}
                        </span>
                        <span className="text-emerald-700 font-semibold block capitalize">
                          Status: {v.activePickups[0].status.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
