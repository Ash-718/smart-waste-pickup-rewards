import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAreaClusters,
  batchAssignArea,
  getVehicles,
  assignVehicleToPickup,
} from "../api/admin";
import { groupPickupsByWard } from "../utils/areaZoneService";

export default function AreaBatchDispatchModal({ pickups = [], onClose }) {
  const queryClient = useQueryClient();
  const [selectedClusterKey, setSelectedClusterKey] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedPickupIds, setSelectedPickupIds] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState(null);

  // 1. Instant client-side cluster derivation (0ms delay)
  const clientClusters = useMemo(() => {
    return groupPickupsByWard(pickups);
  }, [pickups]);

  // 2. Fetch fleet vehicles (standard cached query across admin portal)
  const { data: vehiclesData } = useQuery({
    queryKey: ["adminVehicles"],
    queryFn: getVehicles,
  });

  // 3. Background server-side cluster query (non-blocking)
  const {
    data: serverData,
    isLoading: isServerLoading,
    isError: isServerError,
    error: serverError,
  } = useQuery({
    queryKey: ["area-clusters"],
    queryFn: () => getAreaClusters({ status: "requested" }),
    staleTime: 15000,
    retry: 1,
  });

  // Prefer server clusters once available, otherwise use instant client clusters
  const clusters =
    serverData?.clusters && serverData.clusters.length > 0
      ? serverData.clusters
      : clientClusters;

  // Prefer server vehicles once available, otherwise format from standard getVehicles
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

  // Auto-populate selected pickups when active cluster loads or changes
  useEffect(() => {
    if (currentCluster && currentCluster.pickups) {
      setSelectedPickupIds(new Set(currentCluster.pickups.map((p) => p.id)));
    }
  }, [currentKey, currentCluster?.pickups?.length]);

  const handleSelectCluster = (c) => {
    setSelectedClusterKey(c.clusterKey);
    setSelectedPickupIds(new Set(c.pickups.map((p) => p.id)));
    setErrorMsg(null);
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
        // If batch endpoint returns 404 (endpoint still deploying on Render), fallback to atomic individual assignments
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
      slotPeriod: currentCluster?.slotPeriod,
      requestedDate: currentCluster?.requestedDate,
    });
  };

  // Only show blocking spinner if we have absolutely 0 data (neither local pickups nor server response)
  const isBlockingLoading =
    clusters.length === 0 && isServerLoading && !serverData && pickups.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 bg-emerald-50/50">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <span className="text-xl">📍</span> Area-Wise Batch Dispatch
            </h2>
            <p className="text-xs text-neutral-500">
              Cluster nearby doorstep pickups by neighborhood sector and assign 1 vehicle for sequential collection.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
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
              No unassigned pickup requests pending in the queue.
            </div>
          )}

          {!isBlockingLoading && clusters.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Sector Clusters List */}
              <div className="md:col-span-5 space-y-2 border-r border-neutral-100 pr-0 md:pr-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                    Neighborhood Sectors ({clusters.length})
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Auto-Clustered
                  </span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {clusters.map((c) => {
                    const isSelected = (currentKey || clusters[0]?.clusterKey) === c.clusterKey;
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
                            {c.pickupCount} stops
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
                          <span>Est. {(c.totalEstimatedWeight || 0).toFixed(1)} kg</span>
                          <span className="capitalize">{c.slotPeriod?.toLowerCase() || "Morning"}</span>
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
                      <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                        Doorstep Stops in {currentCluster.wardName}
                      </label>
                      <span className="text-[11px] font-medium text-emerald-700">
                        {selectedPickupIds.size} of {currentCluster.pickups.length} selected
                      </span>
                    </div>

                    {/* Pickup list check items */}
                    <div className="space-y-2 max-h-[220px] overflow-y-auto border border-neutral-200 rounded-xl p-2 bg-neutral-50/50">
                      {currentCluster.pickups.map((p) => {
                        const isChecked = selectedPickupIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => togglePickup(p.id)}
                            className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors shadow-2xs ${
                              isChecked
                                ? "bg-white border-emerald-300"
                                : "bg-white/60 border-neutral-200 opacity-60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-neutral-900 truncate">
                                  {p.user?.name || "Citizen"}
                                </span>
                                <span className="text-[11px] font-semibold text-neutral-600">
                                  {p.wasteType} · {p.wasteQuantity ? `${p.wasteQuantity} kg` : p.quantityBand}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-500 truncate" title={p.address}>
                                {p.address}
                              </p>
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
            disabled={batchMutation.isPending || clusters.length === 0}
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
