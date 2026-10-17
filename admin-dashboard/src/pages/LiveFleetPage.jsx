import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { getLiveFleet } from "../api/admin";
import { getAuthToken, SOCKET_BASE_URL } from "../lib/apiClient";
import LiveFleetMap from "../components/LiveFleetMap";

export default function LiveFleetPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'in_transit', 'idle', 'stale'
  const [connectionState, setConnectionState] = useState("reconnecting"); // 'connected' | 'reconnecting' | 'disconnected'

  const socketRef = useRef(null);

  // Helper for human-readable last telemetry update
  const formatLastUpdate = (timestamp) => {
    if (!timestamp) return "Never";
    const diffSec = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // 1. Initial REST snapshot fetch
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["adminLiveFleet"],
    queryFn: getLiveFleet,
    refetchOnWindowFocus: false,
  });

  // Load initial vehicles snapshot
  useEffect(() => {
    if (data?.vehicles) {
      setVehicles(data.vehicles);
    }
  }, [data]);

  // 2. Real-time Socket.IO Connection (Admin Fleet Room)
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
      // Join admin fleet live room
      socket.emit("join:fleet");
    });

    socket.on("reconnect", () => {
      setConnectionState("connected");
      socket.emit("join:fleet");
    });

    socket.on("reconnecting", () => {
      setConnectionState("reconnecting");
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    socket.on("connect_error", (err) => {
      setConnectionState("reconnecting");
      const msg = err?.message || "";
      if (
        msg.toLowerCase().includes("invalid or expired token") ||
        msg.toLowerCase().includes("jwt expired") ||
        msg.toLowerCase().includes("token missing") ||
        msg.toLowerCase().includes("authentication error")
      ) {
        console.warn("[LiveFleetPage] Admin JWT expired or unauthorized on socket. Disconnecting & redirecting to login:", msg);
        socket.disconnect();
        logout();
        navigate("/login", { replace: true });
      }
    });

    socket.on("join:error", (err) => {
      console.warn("[LiveFleetPage] join:fleet rejected:", err);
      const msg = err?.error || "";
      if (msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("unauthorized")) {
        socket.disconnect();
        logout();
        navigate("/login", { replace: true });
      }
    });

    // Real-time vehicle telemetry listener
    const handleVehicleTelemetry = (telemetry) => {
      if (!telemetry || !telemetry.vehicleId) return;

      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === telemetry.vehicleId) {
            return {
              ...v,
              location: {
                ...v.location,
                lat: telemetry.lat,
                lng: telemetry.lng,
                speed: telemetry.speed || 0,
                heading: telemetry.heading || 0,
                lastLocationAt: telemetry.recordedAt || new Date().toISOString(),
                isStale: false,
                ageSeconds: 0,
              },
            };
          }
          return v;
        })
      );
    };

    socket.on("fleet:vehicle_location", handleVehicleTelemetry);

    // Status changes listener for fleet assignments
    socket.on("pickup:status", () => {
      refetch();
    });

    return () => {
      socket.off("connect");
      socket.off("reconnect");
      socket.off("reconnecting");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("fleet:vehicle_location", handleVehicleTelemetry);
      socket.off("pickup:status");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refetch]);

  // 3. Stale Vehicle Detection Timer (>30s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.location?.lastLocationAt) {
            const age = Math.round((now - new Date(v.location.lastLocationAt).getTime()) / 1000);
            return {
              ...v,
              location: {
                ...v.location,
                ageSeconds: age,
                isStale: age > 30,
              },
            };
          }
          return v;
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 4. Filtering & Search
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchSearch =
        !search ||
        v.registrationNo?.toLowerCase().includes(search) ||
        v.driver?.name?.toLowerCase().includes(search) ||
        v.activePickups?.some((p) => p.address?.toLowerCase().includes(search));

      if (!matchSearch) return false;

      // Status Filter
      if (statusFilter === "in_transit") {
        return (v.location?.speed || 0) > 0 && !v.location?.isStale;
      }
      if (statusFilter === "idle") {
        return (v.location?.speed || 0) === 0 && !v.location?.isStale;
      }
      if (statusFilter === "stale") {
        return v.location?.isStale;
      }
      return true;
    });
  }, [vehicles, searchTerm, statusFilter]);

  const activeCount = vehicles.filter((v) => !v.location?.isStale).length;
  const staleCount = vehicles.filter((v) => v.location?.isStale).length;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">Live Fleet Tracking</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Real-time GPS telemetry from active collection vehicles en route to citizen pickups
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Socket Connection Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              connectionState === "connected"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : connectionState === "reconnecting"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : connectionState === "reconnecting"
                  ? "bg-amber-500 animate-ping"
                  : "bg-rose-500"
              }`}
            />
            <span>
              {connectionState === "connected"
                ? "Live Fleet Connected"
                : connectionState === "reconnecting"
                ? "Reconnecting Socket..."
                : "Disconnected"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main Container: Side Panel + Map */}
      <div className="flex flex-col lg:flex-row flex-1 gap-4 mt-4 overflow-hidden">
        {/* Left Side Panel: Vehicle List & Filters */}
        <div className="w-full lg:w-80 flex flex-col bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden shrink-0">
          {/* Search & Filter Header */}
          <div className="p-3.5 border-b border-neutral-100 space-y-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Search registration, driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
              <span className="absolute left-2.5 top-2.5 text-neutral-400 text-xs">🔍</span>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`flex-1 py-1 rounded-lg transition ${
                  statusFilter === "all" ? "bg-white text-neutral-900 shadow-2xs font-bold" : "text-neutral-500"
                }`}
              >
                All ({vehicles.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("in_transit")}
                className={`flex-1 py-1 rounded-lg transition ${
                  statusFilter === "in_transit"
                    ? "bg-white text-emerald-800 shadow-2xs font-bold"
                    : "text-neutral-500"
                }`}
              >
                In Transit
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("stale")}
                className={`flex-1 py-1 rounded-lg transition ${
                  statusFilter === "stale"
                    ? "bg-white text-neutral-800 shadow-2xs font-bold"
                    : "text-neutral-500"
                }`}
              >
                Stale ({staleCount})
              </button>
            </div>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-2 space-y-1">
            {isLoading && (
              <div className="p-6 text-center text-xs text-neutral-500">Loading active fleet...</div>
            )}

            {isError && (
              <div className="p-4 m-2 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                Failed to load vehicles: {error.message}
              </div>
            )}

            {!isLoading && filteredVehicles.length === 0 && (
              <div className="p-8 text-center text-xs text-neutral-400">
                No active vehicles matching filter.
              </div>
            )}

            {filteredVehicles.map((v) => {
              const isSelected = v.id === selectedVehicleId;
              const isStale = v.location?.isStale;
              const speed = v.location?.speed || 0;

              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicleId(v.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-blue-50/70 border-blue-300 shadow-2xs"
                      : "border-transparent hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-neutral-900">{v.registrationNo}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isStale
                          ? "bg-neutral-100 text-neutral-500"
                          : speed > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {isStale ? "Stale (>30s)" : speed > 0 ? `${speed} km/h` : "Stationary"}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-600 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Driver:</span>
                      <span className="font-medium text-neutral-800">{v.driver?.name || "Unassigned"}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Vehicle:</span>
                      <span>{v.type} ({v.capacity}kg)</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Active Pickups:</span>
                      <span className="font-semibold text-emerald-700">{v.activePickups?.length || 0}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Last Update:</span>
                      <span className="text-neutral-700 font-medium">
                        {formatLastUpdate(v.location?.lastLocationAt)}
                      </span>
                    </div>
                  </div>

                  {v.activePickups?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-neutral-100 text-[10px] text-neutral-600 truncate">
                      <span className="text-neutral-400">Pickup: </span>
                      {v.activePickups[0].address}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Footer Stats */}
          <div className="p-3 bg-neutral-50 border-t border-neutral-100 text-[11px] text-neutral-600 flex justify-between font-medium">
            <span>Online: {activeCount}</span>
            <span>Stale: {staleCount}</span>
            <span>Total Fleet: {vehicles.length}</span>
          </div>
        </div>

        {/* Right Area: Interactive Leaflet Map */}
        <div className="flex-1 bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs relative">
          <LiveFleetMap
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
          />
        </div>
      </div>
    </div>
  );
}
