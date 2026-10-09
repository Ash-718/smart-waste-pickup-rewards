import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCollectors } from "../api/admin";
import { assignPickup } from "../api/pickups";

export default function AssignCollectorModal({ pickup, onClose, onAssigned }) {
  const queryClient = useQueryClient();
  const [selectedCollectorId, setSelectedCollectorId] = useState(
    pickup.assignedAdmin?.id || ""
  );
  const [slotPeriod, setSlotPeriod] = useState(pickup.slotPeriod || "MORNING");
  const [error, setError] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-collectors"],
    queryFn: getAdminCollectors,
  });

  const collectors = data?.collectors || [];

  const mutation = useMutation({
    mutationFn: (payload) => assignPickup(pickup.id, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      queryClient.invalidateQueries({ queryKey: ["pickup", pickup.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
      if (onAssigned) onAssigned(result);
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Failed to assign pickup");
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCollectorId) {
      setError("Please select a pickup collector");
      return;
    }
    mutation.mutate({
      collectorId: selectedCollectorId,
      slotPeriod,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Assign Pickup Collector</h2>
            <p className="text-xs text-neutral-500">Pickup #{pickup.id.slice(0, 8).toUpperCase()} &middot; {pickup.user?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Select Staff / Collector *
            </label>
            {isLoading ? (
              <p className="text-xs text-neutral-500 py-2">Loading collectors list…</p>
            ) : collectors.length === 0 ? (
              <p className="text-xs text-amber-600 py-2">No collectors found. Add one in Staff management.</p>
            ) : (
              <select
                value={selectedCollectorId}
                onChange={(e) => setSelectedCollectorId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                required
              >
                <option value="">-- Choose a collector --</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role}) &middot; {c.phone || c.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Scheduled Slot
            </label>
            <select
              value={slotPeriod}
              onChange={(e) => setSlotPeriod(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
            >
              <option value="MORNING">Morning (8-11 AM)</option>
              <option value="AFTERNOON">Afternoon (12-3 PM)</option>
              <option value="EVENING">Evening (4-7 PM)</option>
            </select>
          </div>

          <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600 space-y-1">
            <p><span className="font-medium text-neutral-900">Address:</span> {pickup.address}</p>
            <p><span className="font-medium text-neutral-900">Waste:</span> {pickup.wasteType} ({pickup.quantityBand})</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !selectedCollectorId}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Assigning…" : "Save Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
