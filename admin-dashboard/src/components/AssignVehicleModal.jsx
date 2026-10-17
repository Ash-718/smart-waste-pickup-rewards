import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getVehicles, assignVehicleToPickup } from "../api/admin";

export default function AssignVehicleModal({ pickup, onClose, onAssigned }) {
  const queryClient = useQueryClient();
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [formError, setFormError] = useState(null);

  // 1. Fetch available fleet vehicles
  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ["adminVehicles"],
    queryFn: getVehicles,
  });

  const allVehicles = vehiclesData?.vehicles || [];

  // Filter: Only active vehicles with an assigned driver
  const eligibleVehicles = useMemo(() => {
    return allVehicles.filter((v) => v.isActive && v.driver && v.registrationNo !== "LEGACY-UNASSIGNED");
  }, [allVehicles]);

  const selectedVehicle = eligibleVehicles.find((v) => v.id === selectedVehicleId);

  // Mutation
  const assignMut = useMutation({
    mutationFn: (payload) => assignVehicleToPickup(pickup.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["adminPickups"] });
      queryClient.invalidateQueries({ queryKey: ["pickup", pickup.id] });
      queryClient.invalidateQueries({ queryKey: ["adminLiveFleet"] });
      onAssigned?.(data);
      onClose();
    },
    onError: (err) => setFormError(err.message),
  });

  const isLockedInTransit = pickup?.status === "on_the_way" || pickup?.status === "arrived";

  const handleAssign = (e) => {
    e.preventDefault();
    setFormError(null);

    if (isLockedInTransit) {
      setFormError("Cannot reassign a vehicle while the trip is already en route ('on_the_way' or 'arrived').");
      return;
    }

    if (!selectedVehicleId) {
      setFormError("Please select a vehicle with an assigned driver");
      return;
    }

    if (!selectedVehicle?.driver?.id) {
      setFormError("Selected vehicle has no assigned driver/collector");
      return;
    }

    assignMut.mutate({
      vehicleId: selectedVehicle.id,
      collectorId: selectedVehicle.driver.id,
    });
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutral-200 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Assign Fleet Vehicle & Collector</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Pickup ID: {pickup.id?.slice(0, 8)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 text-sm font-bold p-1"
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

        {/* Pickup Context Summary */}
        <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 mb-4 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-500">Citizen:</span>
            <span className="font-semibold text-neutral-900">{pickup.user?.name || "Customer"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Current Status:</span>
            <span className="font-bold text-neutral-900 capitalize">{pickup.status?.replace(/_/g, " ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Address:</span>
            <span className="font-medium text-neutral-900 truncate max-w-[240px]">{pickup.address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Waste Details:</span>
            <span className="text-neutral-800">{pickup.wasteType} ({pickup.quantityBand})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Current Vehicle:</span>
            <span className="font-bold text-neutral-900">
              {pickup.assignments?.[0]?.vehicle?.registrationNo ||
               pickup.vehicleAssignments?.[0]?.vehicle?.registrationNo ||
               (pickup.assignedAdmin ? `${pickup.assignedAdmin.name} (Legacy)` : "None")}
            </span>
          </div>
        </div>

        <form onSubmit={handleAssign} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-neutral-700 block mb-1">
              Select Fleet Vehicle & Driver
            </label>
            {isLoading ? (
              <div className="p-3 bg-neutral-50 rounded-xl text-neutral-400">Loading fleet vehicles...</div>
            ) : eligibleVehicles.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
                No active vehicles with drivers available. Please register or assign a driver to a vehicle first.
              </div>
            ) : (
              <select
                disabled={isLockedInTransit}
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value="">-- Choose an active vehicle --</option>
                {eligibleVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNo} — {v.driver?.name} ({v.type}, {v.capacity}kg)
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedVehicle && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 space-y-1">
              <div className="font-bold">✓ Ready for Real-Time Live Tracking</div>
              <div>Collector: {selectedVehicle.driver?.name} ({selectedVehicle.driver?.phone || "No phone"})</div>
              <div>Capacity: {selectedVehicle.capacity} kg • Type: {selectedVehicle.type}</div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLockedInTransit || !selectedVehicleId || assignMut.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 transition shadow-xs"
            >
              {assignMut.isPending ? "Assigning..." : "Assign Vehicle & Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
