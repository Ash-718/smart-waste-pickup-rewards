import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAreaClusters,
  batchAssignArea,
  getVehicles,
  assignVehicleToPickup,
} from "../api/admin";
import { groupPickupsByWard } from "../utils/areaZoneService";
import {
  PinIcon,
  LightningIcon,
  VehicleIcon,
  PickupIcon,
  ClockIcon,
  CheckCircleIcon,
  MorningSunIcon,
  AfternoonSunIcon,
  EveningMoonIcon,
} from "./Icons";

function renderSlotBadge(slot) {
  const s = (slot || "").toUpperCase();
  if (s === "MORNING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <MorningSunIcon className="w-3 h-3 text-amber-600" />
        <span>Morning (7-11 AM)</span>
      </span>
    );
  }
  if (s === "AFTERNOON") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
        <AfternoonSunIcon className="w-3 h-3 text-orange-600" />
        <span>Afternoon (12-4 PM)</span>
      </span>
    );
  }
  if (s === "EVENING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
        <EveningMoonIcon className="w-3 h-3 text-indigo-600" />
        <span>Evening (4-7 PM)</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
      <ClockIcon className="w-3 h-3 text-neutral-500" />
      <span>Any Slot</span>
    </span>
  );
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

  const selectedVehicle = availableVehicles.find((v) => v.id === selectedVehicleId);
  const vehicleCapacity = selectedVehicle?.capacity || 1000;
  const capacityPercent = Math.min(100, Math.round((selectedWeight / vehicleCapacity) * 100));

  const batchMutation = useMutation({
    mutationFn: async (payload) => {
      try {
        return await batchAssignArea(payload);
      } catch (err) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 bg-gradient-to-r from-emerald-50/60 to-teal-50/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm">
              <PickupIcon className="w-5 h-5 text-white" />
            </span>
            <div>
              <h2 className="text-base font-bold text-neutral-900 tracking-tight">
                Multi-Stop Area Dispatch & Routing
              </h2>
              <p className="text-xs text-neutral-500">
                Group nearby doorstep pickups by neighborhood sector and time slot to dispatch 1 vehicle for sequential collection.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Time Slot Filter Bar */}
        <div className="border-b border-neutral-200 bg-neutral-50/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5 text-neutral-500" />
              <span>Time Slot:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: "All Slots", icon: null },
                { id: "MORNING", label: "Morning (7-11 AM)", Icon: MorningSunIcon },
                { id: "AFTERNOON", label: "Afternoon (12-4 PM)", Icon: AfternoonSunIcon },
                { id: "EVENING", label: "Evening (4-7 PM)", Icon: EveningMoonIcon },
              ].map(({ id, label, Icon }) => {
                const isActive = slotFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSlotFilter(id);
                      setSelectedPickupIds(new Set());
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-95 ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-xs font-bold"
                        : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100/80 hover:text-neutral-900"
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-neutral-500 font-medium">
            <strong className="text-neutral-800">{clusters.length}</strong> sectors available
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isBlockingLoading && (
            <div className="py-12 text-center text-xs text-neutral-500">
              <div className="inline-block animate-spin text-lg mb-2 text-emerald-600">
                <LightningIcon className="w-6 h-6 mx-auto" />
              </div>
              <p>Scanning pickups and resolving neighborhood sectors…</p>
            </div>
          )}

          {!isBlockingLoading && clusters.length === 0 && (
            <div className="py-12 text-center text-xs text-neutral-500">
              <CheckCircleIcon className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              No pending pickup requests found for this time slot.
            </div>
          )}

          {!isBlockingLoading && clusters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Sector Clusters List */}
              <div className="md:col-span-5 space-y-2 border-r border-neutral-100 pr-0 md:pr-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1">
                    <PinIcon className="w-3 h-3 text-emerald-600" />
                    <span>Sectors ({clusters.length})</span>
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {slotFilter === "all" ? "All Time Slots" : slotFilter}
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
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 select-none ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-600/30"
                            : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/60 bg-white"
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
                            {breakdownText || "All Slots"}
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
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs"
                        >
                          Select All ({currentCluster.pickups.length})
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-all active:scale-95 cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Pickup list check items */}
                    <div className="space-y-2 max-h-[220px] overflow-y-auto border border-neutral-200 rounded-xl p-2 bg-neutral-50/50">
                      {currentCluster.pickups.map((p) => {
                        const isChecked = selectedPickupIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => togglePickup(p.id)}
                            className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all duration-150 shadow-2xs select-none ${
                              isChecked
                                ? "bg-white border-emerald-400 ring-1 ring-emerald-500/20"
                                : "bg-white/70 border-neutral-200 hover:border-neutral-300 opacity-60"
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
                                {renderSlotBadge(p.slotPeriod)}
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1">
                                <span className="truncate max-w-[210px] flex items-center gap-1" title={p.address}>
                                  <PinIcon className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                                  <span className="truncate">{p.address}</span>
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
                    <div className="space-y-2 pt-1">
                      <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <VehicleIcon className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Assign Municipal Vehicle & Collector</span>
                        </span>
                        {availableVehicles.length > 0 && (
                          <span className="text-[11px] font-normal text-neutral-500">
                            {availableVehicles.filter((v) => !v.isEnRoute).length} available
                          </span>
                        )}
                      </label>
                      <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 cursor-pointer shadow-2xs"
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

                      {/* Interactive Vehicle Capacity Meter */}
                      {selectedVehicle && (
                        <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-neutral-600">Vehicle Payload Utilization</span>
                            <span className="font-bold text-emerald-800">
                              {selectedWeight.toFixed(1)} / {vehicleCapacity} kg ({capacityPercent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${Math.max(4, Math.min(100, capacityPercent))}%` }}
                            />
                          </div>
                        </div>
                      )}
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
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-2 text-xs font-bold text-white shadow-xs hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            {batchMutation.isPending ? (
              <>
                <span className="inline-block animate-spin">⚡</span>
                <span>Dispatching…</span>
              </>
            ) : (
              <>
                <LightningIcon className="w-4 h-4" />
                <span>Dispatch Vehicle to Sector ({selectedPickupIds.size} Stops)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
