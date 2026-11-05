import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAreaClusters,
  batchAssignArea,
  getVehicles,
  assignVehicleToPickup,
} from "../api/admin";
import { groupPickupsByWard } from "../utils/areaZoneService";

function formatSlotBadge(slot) {
  const s = (slot || "").toUpperCase();
  if (s === "MORNING") return "🌅 Morning (7-11 AM)";
  if (s === "AFTERNOON") return "☀️ Afternoon (12-4 PM)";
  if (s === "EVENING") return "🌆 Evening (4-7 PM)";
  return "🕒 Regular Slot";
}

export default function AreaBatchDispatchModal({
  pickups = [],
  initialSelectedIds = null,
  onClose,
}) {
  const queryClient = useQueryClient();
  const [slotFilter, setSlotFilter] = useState("all");
  const [selectedClusterKey, setSelectedClusterKey] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedPickupIds, setSelectedPickupIds] = useState(
    initialSelectedIds ? new Set(initialSelectedIds) : new Set()
  );
  const [errorMsg, setErrorMsg] = useState(null);

  // 1. Instant client-side cluster derivation with time-slot support (0ms delay)
  const clientClusters = useMemo(() => {
    return groupPickupsByWard(pickups, { slotFilter });
  }, [pickups, slotFilter]);

  // 2. Fetch fleet vehicles (cached query across admin portal)
  const { data: vehiclesData } = useQuery({
    queryKey: ["adminVehicles"],
    queryFn: getVehicles,
  });

  // 3. Background server-side cluster query
  const { data: serverData, isLoading: isServerLoading } = useQuery({
    queryKey: ["area-clusters", slotFilter],
    queryFn: () =>
      getAreaClusters({
        status: "requested",
        ...(slotFilter !== "all" ? { slotPeriod: slotFilter } : {}),
      }),
    staleTime: 15000,
    retry: 1,
  });

  // Prefer server clusters once available if they have data, otherwise instant client clusters
  const clusters =
    serverData?.clusters && serverData.clusters.length > 0
      ? serverData.clusters
      : clientClusters;

  // Format available vehicles
  const availableVehicles = useMemo(() => {
    if (serverData?.availableVehicles && serverData.availableVehicles.length > 0) {
      return serverData.availableVehicles;
    }
    const rawVehicles = vehiclesData?.vehicles || [];
    return rawVehicles
      .filter((v) => v.isActive && v.registrationNo !== "LEGACY-UNASSIGNED")
      .map((v) => {
        const activeAssignments = (v.assignments || []).filter((a) => a.isActive);
        const isEnRoute = activeAssignments.some((a) =>
          ["on_the_way", "arrived"].includes(a.pickup?.status)
        );
        return {
          id: v.id,
          registrationNo: v.registrationNo,
          type: v.type,
          capacity: v.capacity,
          driver: v.driver,
          activeAssignmentsCount: activeAssignments.length,
          isEnRoute,
        };
      });
  }, [serverData, vehiclesData]);

  // Active cluster selection
  const activeCluster =
    clusters.find((c) => c.clusterKey === selectedClusterKey) || clusters[0];
  const currentKey = selectedClusterKey || activeCluster?.clusterKey;
  const currentCluster = clusters.find((c) => c.clusterKey === currentKey);

  // Auto-populate selected pickups on first cluster load if none selected
  useEffect(() => {
    if (currentCluster && currentCluster.pickups && selectedPickupIds.size === 0) {
      setSelectedPickupIds(new Set(currentCluster.pickups.map((p) => p.id)));
    }
  }, [currentKey]);

  const handleSelectCluster = (c) => {
    setSelectedClusterKey(c.clusterKey);
    setSelectedPickupIds(new Set(c.pickups.map((p) => p.id)));
    setErrorMsg(null);
  };

  const handleSelectAll = () => {
    if (currentCluster) {
      setSelectedPickupIds(new Set(currentCluster.pickups.map((p) => p.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedPickupIds(new Set());
  };

  const togglePickup = (id) => {
    const next = new Set(selectedPickupIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPickupIds(next);
  };

  // Calculate selected total weight
  const selectedWeight = useMemo(() => {
    if (!currentCluster) return 0;
    return currentCluster.pickups
      .filter((p) => selectedPickupIds.has(p.id))
      .reduce((sum, p) => {
        const w =
          p.wasteQuantity ||
          (p.quantityBand === "LARGE" ? 15 : p.quantityBand === "MEDIUM" ? 8 : 3);
        return sum + Number(w);
      }, 0);
  }, [currentCluster, selectedPickupIds]);

  const batchMutation = useMutation({
    mutationFn: async (payload) => {
      try {
        return await batchAssignArea(payload);
      } catch (err) {
        // Fallback to sequential individual assignments if batch endpoint has a network delay or 404
        if (
          err.status === 404 ||
          err.message?.includes("Not found") ||
          err.message?.includes("404")
        ) {
          console.warn("Batch endpoint 404, falling back to individual assignments:", err);
          const results = await Promise.all(
            payload.pickupIds.map((id) =>
              assignVehicleToPickup(id, {
                vehicleId: payload.vehicleId,
                slotPeriod: payload.slotPeriod,
                requestedDate: payload.requestedDate,
              })
            )
          );
          return { success: true, count: results.length, fallback: true };
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      queryClient.invalidateQueries({ queryKey: ["area-clusters"] });
      queryClient.invalidateQueries({ queryKey: ["adminVehicles"] });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to dispatch vehicle to area");
    },
  });

  const handleDispatch = () => {
    setErrorMsg(null);
    if (!selectedVehicleId) {
      setErrorMsg("Please select a municipal vehicle to dispatch");
      return;
    }
    const pickupIds = Array.from(selectedPickupIds);
    if (pickupIds.length === 0) {
      setErrorMsg("Please select at least one pickup in this sector to assign");
      return;
    }

    batchMutation.mutate({
      vehicleId: selectedVehicleId,
      pickupIds,
      slotPeriod: slotFilter !== "all" ? slotFilter : currentCluster?.slotPeriod,
      requestedDate: currentCluster?.requestedDate,
    });
  };

  const isBlockingLoading =
    clusters.length === 0 && isServerLoading && !serverData && pickups.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 bg-emerald-50/50">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <span className="text-xl">📍</span> Area-Wise Batch Dispatch & Routing
            </h2>
            <p className="text-xs text-neutral-500">
              Group nearby doorstep pickups by neighborhood sector and time slot to dispatch 1 vehicle for collection.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Time Slot Filter Bar */}
        <div className="border-b border-neutral-200 bg-neutral-50/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
              <span>🕒</span> Time Slot:
            </span>
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "All Slots" },
                { id: "MORNING", label: "🌅 Morning" },
                { id: "AFTERNOON", label: "☀️ Afternoon" },
                { id: "EVENING", label: "🌆 Evening" },
              ].map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => {
                    setSlotFilter(slot.id);
                    setSelectedPickupIds(new Set());
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    slotFilter === slot.id
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-neutral-500">
            Showing <strong className="text-neutral-800">{clusters.length}</strong> neighborhood sectors
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isBlockingLoading && (
            <div className="py-12 text-center text-xs text-neutral-500">
              <div className="inline-block animate-spin text-lg mb-2">⚡</div>
              <p>Scanning pickups and generating area clusters…</p>
            </div>
          )}

          {!isBlockingLoading && clusters.length === 0 && (
            <div className="py-12 text-center text-xs text-neutral-500">
              <span className="text-2xl block mb-2">✅</span>
              No pending pickup requests found for this time slot.
            </div>
          )}

          {!isBlockingLoading && clusters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Sector Clusters List */}
              <div className="md:col-span-5 space-y-2 border-r border-neutral-100 pr-0 md:pr-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Sectors ({clusters.length})
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {slotFilter === "all" ? "All Slots" : slotFilter}
                  </span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {clusters.map((c) => {
                    const isSelected = (currentKey || clusters[0]?.clusterKey) === c.clusterKey;
                    const breakdown = c.slotBreakdown || {};
                    const breakdownText = [
                      breakdown.MORNING ? `${breakdown.MORNING} Morning` : null,
                      breakdown.AFTERNOON ? `${breakdown.AFTERNOON} Afternoon` : null,
                      breakdown.EVENING ? `${breakdown.EVENING} Evening` : null,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div
                        key={c.clusterKey}
                        onClick={() => handleSelectCluster(c)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-600/20"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-neutral-900">{c.wardName}</span>
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {c.pickupCount} {c.pickupCount === 1 ? "stop" : "stops"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
                          <span>Est. {(c.totalEstimatedWeight || 0).toFixed(1)} kg</span>
                          <span className="font-medium text-emerald-700 truncate max-w-[140px]">
                            {breakdownText || (c.slotPeriod ? formatSlotBadge(c.slotPeriod) : "All Slots")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Pickups in Selected Sector & Vehicle Assignment */}
              <div className="md:col-span-7 space-y-4">
                {currentCluster && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider block">
                          Stops in {currentCluster.wardName}
                        </label>
                        <span className="text-[11px] text-emerald-700 font-semibold">
                          {selectedPickupIds.size} of {currentCluster.pickups.length} selected ({selectedWeight.toFixed(1)} kg)
                        </span>
                      </div>

                      {/* Multi-Select Quick Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Select All ({currentCluster.pickups.length})
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Pickup list check items */}
                    <div className="space-y-2 max-h-[240px] overflow-y-auto border border-neutral-200 rounded-xl p-2 bg-neutral-50/50">
                      {currentCluster.pickups.map((p) => {
                        const isChecked = selectedPickupIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => togglePickup(p.id)}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all shadow-2xs select-none ${
                              isChecked
                                ? "bg-white border-emerald-400 ring-1 ring-emerald-500/20"
                                : "bg-white/60 border-neutral-200 hover:border-neutral-300 opacity-60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => togglePickup(p.id)}
                              className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-xs text-neutral-900 truncate">
                                  {p.user?.name || "Citizen"}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200 whitespace-nowrap">
                                  {formatSlotBadge(p.slotPeriod)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                                <span className="truncate max-w-[210px]" title={p.address}>
                                  📍 {p.address}
                                </span>
                                <span className="font-semibold text-emerald-800 whitespace-nowrap">
                                  {p.wasteType} · {p.wasteQuantity ? `${p.wasteQuantity} kg` : p.quantityBand || "3.5 kg"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Vehicle Selector */}
                    <div className="space-y-1.5 pt-2">
                      <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                        <span>Assign Municipal Vehicle & Collector</span>
                        {availableVehicles.length > 0 && (
                          <span className="text-[11px] font-normal text-neutral-500">
                            {availableVehicles.filter((v) => !v.isEnRoute).length} available
                          </span>
                        )}
                      </label>
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                      >
                        <option value="">-- Choose Municipal Vehicle --</option>
                        {availableVehicles.map((v) => (
                          <option key={v.id} value={v.id} disabled={v.isEnRoute}>
                            {v.registrationNo} — {v.driver?.name || "Unassigned"} ({v.type})
                            {v.isEnRoute
                              ? " [Currently En Route]"
                              : v.activeAssignmentsCount > 0
                              ? ` [${v.activeAssignmentsCount} assigned]`
                              : " [Available]"}
                          </option>
                        ))}
                      </select>
                    </div>

                    {errorMsg && (
                      <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
                        {errorMsg}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-3.5 bg-neutral-50">
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={batchMutation.isPending || clusters.length === 0 || selectedPickupIds.size === 0}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
          >
            {batchMutation.isPending ? (
              <>
                <span className="inline-block animate-spin">⚡</span>
                <span>Dispatching…</span>
              </>
            ) : (
              `⚡ Dispatch Vehicle to Sector (${selectedPickupIds.size} Stops)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
