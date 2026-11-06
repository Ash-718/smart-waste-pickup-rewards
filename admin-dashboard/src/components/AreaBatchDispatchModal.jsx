import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAreaClusters,
  batchAssignArea,
  getVehicles,
  assignVehicleToPickup,
} from "../api/admin";
import { groupPickupsByWard } from "../utils/areaZoneService";
import { VehicleIcon } from "./Icons";

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

  // 1. Instant client-side cluster derivation with time-slot support
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

  const clusters =
    serverData?.clusters && serverData.clusters.length > 0
      ? serverData.clusters
      : clientClusters;

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
      setErrorMsg("Please choose a municipal vehicle to dispatch");
      return;
    }
    const pickupIds = Array.from(selectedPickupIds);
    if (pickupIds.length === 0) {
      setErrorMsg("Please select at least one pickup stop to assign");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 bg-neutral-50/60">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
              <VehicleIcon className="w-4 h-4 text-white" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                Area-Wise Batch Dispatch
              </h2>
              <p className="text-xs text-neutral-500">
                Dispatch 1 municipal vehicle for sequential collection in a neighborhood.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Clean Controls: Sector & Time Slot */}
        <div className="p-4 border-b border-neutral-100 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Sector Selector */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Area / Ward Sector
              </label>
              <select
                value={currentKey || ""}
                onChange={(e) => {
                  const c = clusters.find((cl) => cl.clusterKey === e.target.value);
                  if (c) handleSelectCluster(c);
                }}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 focus:border-emerald-600 focus:outline-hidden cursor-pointer"
              >
                {clusters.map((c) => (
                  <option key={c.clusterKey} value={c.clusterKey}>
                    📍 {c.wardName} ({c.pickupCount} {c.pickupCount === 1 ? "stop" : "stops"})
                  </option>
                ))}
              </select>
            </div>

            {/* Time Slot Filter Pills */}
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Time Slot
              </label>
              <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
                {[
                  { id: "all", label: "All" },
                  { id: "MORNING", label: "Morning" },
                  { id: "AFTERNOON", label: "Afternoon" },
                  { id: "EVENING", label: "Evening" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSlotFilter(s.id);
                      setSelectedPickupIds(new Set());
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      slotFilter === s.id
                        ? "bg-white text-emerald-800 shadow-2xs"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stops List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isBlockingLoading && (
            <div className="py-10 text-center text-xs text-neutral-500">
              Scanning pickups and resolving neighborhood sectors…
            </div>
          )}

          {!isBlockingLoading && clusters.length === 0 && (
            <div className="py-10 text-center text-xs text-neutral-500">
              No pending pickup requests found for this filter.
            </div>
          )}

          {!isBlockingLoading && currentCluster && (
            <>
              {/* Stops Header with Select All / Clear */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Stops to Collect ({selectedPickupIds.size} of {currentCluster.pickups.length} selected)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-neutral-300">·</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="font-medium text-neutral-500 hover:text-neutral-700 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Stops Check List */}
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {currentCluster.pickups.map((p) => {
                  const isChecked = selectedPickupIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePickup(p.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                        isChecked
                          ? "bg-emerald-50/40 border-emerald-300 shadow-2xs ring-1 ring-emerald-500/20"
                          : "bg-white border-neutral-200 hover:border-neutral-300 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => togglePickup(p.id)}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-neutral-900 truncate">
                            {p.user?.name || "Citizen"}
                          </span>
                          <span className="text-neutral-600 font-semibold text-[11px] whitespace-nowrap">
                            {p.wasteType} · {p.wasteQuantity ? `${p.wasteQuantity} kg` : p.quantityBand || "3.5 kg"}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 truncate mt-0.5" title={p.address}>
                          {p.address}
                        </div>
                      </div>
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 capitalize whitespace-nowrap">
                        {(p.slotPeriod || "Morning").toLowerCase()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Vehicle Assignment Dropdown */}
              <div className="pt-2 border-t border-neutral-100">
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Assign Municipal Vehicle & Collector
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 focus:border-emerald-600 focus:outline-hidden cursor-pointer shadow-2xs"
                >
                  <option value="">-- Choose Municipal Vehicle --</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNo} — {v.driver?.name || "Unassigned"} ({v.type})
                      {v.isEnRoute
                        ? " [En Route — will queue next]"
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
            disabled={batchMutation.isPending || selectedPickupIds.size === 0 || !selectedVehicleId}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            {batchMutation.isPending
              ? "Dispatching…"
              : `Dispatch Vehicle (${selectedPickupIds.size} Stops)`}
          </button>
        </div>
      </div>
    </div>
  );
}
