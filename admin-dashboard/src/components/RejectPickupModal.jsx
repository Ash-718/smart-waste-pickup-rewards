import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePickupStatus } from "../api/pickups";

function formatEstimatedWeight(pickup) {
  if (pickup.wasteQuantity) return `${pickup.wasteQuantity} kg`;
  if (pickup.quantityBand === "SMALL") return "1.5 kg (Small)";
  if (pickup.quantityBand === "MEDIUM") return "3.5 kg (Medium)";
  if (pickup.quantityBand === "LARGE") return "7.5 kg (Large)";
  return pickup.quantityBand || "Not specified";
}

export default function RejectPickupModal({ pickup, onClose, onRejected }) {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (reason) => {
      // If no reason was explicitly typed, supply a professional default explanation
      const effectiveReason = reason.trim() || "Request does not meet recycling or collection guidelines.";
      return updatePickupStatus(pickup.id, {
        status: "rejected",
        rejectionReason: effectiveReason,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      queryClient.invalidateQueries({ queryKey: ["pickup", pickup.id] });
      queryClient.invalidateQueries({ queryKey: ["adminPickups"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
      if (onRejected) onRejected(result);
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Failed to reject pickup");
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (mutation.isPending) return;
    setError(null);
    mutation.mutate(rejectionReason);
  }

  const formattedDate = pickup.requestedDate
    ? new Date(pickup.requestedDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not specified";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-rose-700 flex items-center gap-1.5">
              <span>✕</span>
              <span>Reject Pickup Request</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Pickup #{pickup.id.slice(0, 8).toUpperCase()} &middot; Citizen: {pickup.user?.name || "Customer"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Pickup Context Summary */}
        <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 mb-4 space-y-2 text-xs">
          <div className="font-semibold text-neutral-700 uppercase tracking-wider text-[10px] border-b border-neutral-200/50 pb-1">
            Pickup Details to be Rejected
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-neutral-500 block text-[11px]">Citizen</span>
              <span className="font-semibold text-neutral-900">{pickup.user?.name || "Unknown"}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Status</span>
              <span className="font-bold text-neutral-900 capitalize">{pickup.status?.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Waste Material</span>
              <span className="font-semibold text-neutral-900">{pickup.wasteType?.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">Quantity / Weight</span>
              <span className="font-semibold text-neutral-900">{formatEstimatedWeight(pickup)}</span>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Rejection Reason <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Uploaded photo shows contaminated/non-recyclable waste, or location is outside perimeter (leave blank for standard reason)"
              className="w-full rounded-xl border border-neutral-300 p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-rose-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500 bg-white"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              This explanation will be recorded and displayed to the citizen in their mobile app.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
            >
              {mutation.isPending ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Rejecting…</span>
                </>
              ) : (
                <>
                  <span>✕</span>
                  <span>Confirm Rejection</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
