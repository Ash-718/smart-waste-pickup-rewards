import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVehicles, getAdminCollectors, assignVehicleToPickup } from "../api/admin";

function formatEstimatedWeight(pickup) {
  if (pickup.wasteQuantity) return `${pickup.wasteQuantity} kg`;
  if (pickup.quantityBand === "SMALL") return "1.5 kg (Small)";
  if (pickup.quantityBand === "MEDIUM") return "3.5 kg (Medium)";
  if (pickup.quantityBand === "LARGE") return "7.5 kg (Large)";
  return pickup.quantityBand || "Not specified";
}

export default function AssignVehicleModal({ pickup, onClose, onAssigned }) {
  const queryClient = useQueryClient();
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    pickup.assignments?.[0]?.vehicleId || ""
  );
  const [selectedCollectorId, setSelectedCollectorId] = useState(
    pickup.assignments?.[0]?.vehicle?.driverId || pickup.assignedAdminId || ""
  );
  const [slotPeriod, setSlotPeriod] = useState(pickup.slotPeriod || "MORNING");
  const [formError, setFormError] = useState(null);

  // 1. Fetch available fleet vehicles
  const { data: vehiclesData, isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["adminVehicles"],
    queryFn: getVehicles,
  });

  // 2. Fetch available staff / collectors
  const { data: collectorsData, isLoading: isLoadingCollectors } = useQuery({
    queryKey: ["admin-collectors"],
    queryFn: getAdminCollectors,
  });

  const allVehicles = vehiclesData?.vehicles || [];
  const allCollectors = collectorsData?.collectors || [];

  // Filter: Active vehicles
  const eligibleVehicles = useMemo(() => {
    return allVehicles.filter(
      (v) => v.isActive && v.registrationNo !== "LEGACY-UNASSIGNED"
    );
  }, [allVehicles]);

  const selectedVehicle = eligibleVehicles.find((v) => v.id === selectedVehicleId);
  const selectedCollector = allCollectors.find((c) => c.id === selectedCollectorId);

  // Auto-sync driver when vehicle changes
  const handleVehicleChange = (vId) => {
    setSelectedVehicleId(vId);
    setFormError(null);
    const vehicle = eligibleVehicles.find((v) => v.id === vId);
    if (vehicle?.driver?.id) {
      setSelectedCollectorId(vehicle.driver.id);
    }
  };

  // Auto-sync vehicle when collector changes
  const handleCollectorChange = (cId) => {
    setSelectedCollectorId(cId);
    setFormError(null);
    const linkedVehicle = eligibleVehicles.find((v) => v.driverId === cId || v.driver?.id === cId);
    if (linkedVehicle) {
      setSelectedVehicleId(linkedVehicle.id);
    }
  };

  // Mutation
  const assignMut = useMutation({
    mutationFn: (payload) => assignVehicleToPickup(pickup.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      queryClient.invalidateQueries({ queryKey: ["pickup", pickup.id] });
      queryClient.invalidateQueries({ queryKey: ["adminPickups"] });
      queryClient.invalidateQueries({ queryKey: ["adminVehicles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-collectors"] });
      queryClient.invalidateQueries({ queryKey: ["adminLiveFleet"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
      onAssigned?.(data);
      onClose();
    },
    onError: (err) => setFormError(err.message || "Failed to assign pickup"),
  });

  const isLockedInTransit = pickup?.status === "on_the_way" || pickup?.status === "arrived";

  const handleAssign = (e) => {
    e.preventDefault();
    setFormError(null);

    if (isLockedInTransit) {
      setFormError(
        "Cannot reassign a vehicle while the trip is already en route ('on_the_way' or 'arrived')."
      );
      return;
    }

    if (!selectedVehicleId) {
      setFormError("Please select a collection vehicle");
      return;
    }

    if (!selectedVehicle) {
      setFormError("Selected vehicle is not eligible or active");
      return;
    }

    const effectiveCollectorId = selectedCollectorId || selectedVehicle.driver?.id;
    if (!effectiveCollectorId) {
      setFormError(
        `Selected vehicle "${selectedVehicle.registrationNo}" has no assigned driver. Please select an eligible staff collector.`
      );
      return;
    }

    assignMut.mutate({
      vehicleId: selectedVehicle.id,
      collectorId: effectiveCollectorId,
      slotPeriod,
    });
  };

  const formattedDate = pickup.requestedDate
    ? new Date(pickup.requestedDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not specified";

  return (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutral-200 animate-in fade-in duration-200 my-8 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              {pickup.status === "assigned" ? "Reassign Pickup & Fleet" : "Accept Pickup & Assign Fleet"}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Pickup #{pickup.id?.slice(0, 8).toUpperCase()} &middot; Citizen: {pickup.user?.name || "Customer"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 text-sm font-bold p-1 rounded-lg hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        {/* In-Transit Lock Warning */}
        {isLockedInTransit && (
          <div className="p-3 mb-4 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>
              This pickup is currently <strong>{pickup.status}</strong>. Reassignment is disabled until the active trip is completed.
            </span>
          </div>
        )}

        {formError && (
          <div className="p-3 mb-4 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
            {formError}
          </div>
        )}

        {/* Complete Pickup Details Context Summary */}
        <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 mb-4 space-y-2 text-xs">
          <div className="font-semibold text-neutral-700 uppercase tracking-wider text-[10px] border-b border-neutral-200/50 pb-1">
            Pickup Request Specifications
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-neutral-500 block text-[11px]">Citizen</span>
              <span className="font-semibold text-neutral-900">{pickup.user?.name || "Unknown"}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Current Status</span>
              <span className="font-bold text-neutral-900 capitalize">{pickup.status?.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Waste Category</span>
              <span className="font-semibold text-neutral-900">{pickup.wasteType?.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Estimated Weight</span>
              <span className="font-semibold text-emerald-800">{formatEstimatedWeight(pickup)}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Requested Date</span>
              <span className="font-medium text-neutral-900">{formattedDate}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Time Slot</span>
              <span className="font-medium text-neutral-900">{pickup.slotPeriod || "Morning"}</span>
            </div>
          </div>
          <div className="pt-1 border-t border-neutral-200/50">
            <span className="text-neutral-500 block text-[11px]">Pickup Address</span>
            <span className="font-medium text-neutral-900 break-words">{pickup.address}</span>
          </div>
        </div>

        {/* Assignment Form */}
        <form onSubmit={handleAssign} className="space-y-4 text-xs">
          {/* Select Vehicle */}
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">
              Select Fleet Vehicle *
            </label>
            {isLoadingVehicles ? (
              <div className="p-3 bg-neutral-50 rounded-xl text-neutral-400">Loading vehicles…</div>
            ) : eligibleVehicles.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
                No active collection vehicles available. Please register one in Fleet management.
              </div>
            ) : (
              <select
                disabled={isLockedInTransit}
                value={selectedVehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium text-xs"
                required
              >
                <option value="">-- Choose an active vehicle --</option>
                {eligibleVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    🚛 {v.registrationNo} — {v.type} ({v.capacity}kg capacity){v.driver ? ` · Driver: ${v.driver.name}` : " · (No driver assigned)"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Select Staff Member / Collector */}
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">
              Select Assigned Staff / Collector *
            </label>
            {isLoadingCollectors ? (
              <div className="p-3 bg-neutral-50 rounded-xl text-neutral-400">Loading staff collectors…</div>
            ) : allCollectors.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
                No staff members with collector role found.
              </div>
            ) : (
              <select
                disabled={isLockedInTransit}
                value={selectedCollectorId}
                onChange={(e) => handleCollectorChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium text-xs"
                required
              >
                <option value="">-- Choose a collector / driver --</option>
                {allCollectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    👤 {c.name} ({c.role}){c.phone ? ` · ${c.phone}` : ""}{c.activeAssignmentsCount > 0 ? ` [${c.activeAssignmentsCount} active]` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scheduled Slot Period */}
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">
              Confirmed Slot Period
            </label>
            <select
              disabled={isLockedInTransit}
              value={slotPeriod}
              onChange={(e) => setSlotPeriod(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium text-xs"
            >
              <option value="MORNING">Morning (8:00 AM – 11:00 AM)</option>
              <option value="AFTERNOON">Afternoon (12:00 PM – 3:00 PM)</option>
              <option value="EVENING">Evening (4:00 PM – 7:00 PM)</option>
            </select>
          </div>

          {/* Selection Confirmation Preview */}
          {selectedVehicle && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>✓</span>
                <span>Assignment Ready</span>
              </div>
              <div>
                <strong>Vehicle:</strong> {selectedVehicle.registrationNo} ({selectedVehicle.type}, {selectedVehicle.capacity}kg max payload)
              </div>
              <div>
                <strong>Collector:</strong> {selectedCollector?.name || selectedVehicle.driver?.name || "None"} ({selectedCollector?.phone || selectedVehicle.driver?.phone || "No phone"})
              </div>
              <div className="text-emerald-700 text-[10px] mt-1">
                Once assigned, pickup status transitions to <strong>Assigned</strong> and real-time tracking is enabled.
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={assignMut.isPending}
              className="px-4 py-2 border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLockedInTransit || !selectedVehicleId || assignMut.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 transition shadow-xs flex items-center gap-1.5"
            >
              {assignMut.isPending ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Saving Assignment…</span>
                </>
              ) : (
                <>
                  <span>🚛</span>
                  <span>{pickup.status === "assigned" ? "Confirm Reassignment" : "Accept & Assign"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
