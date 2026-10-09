import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePickupStatus } from "../api/pickups";

export default function RejectPickupModal({ pickup, onClose, onRejected }) {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (reason) =>
      updatePickupStatus(pickup.id, {
        status: "rejected",
        rejectionReason: reason.trim(),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      queryClient.invalidateQueries({ queryKey: ["pickup", pickup.id] });
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
    if (!rejectionReason.trim()) {
      setError("A rejection reason is mandatory.");
      return;
    }
    mutation.mutate(rejectionReason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-rose-700">Reject Pickup Request</h2>
            <p className="text-xs text-neutral-500">
              Pickup #{pickup.id.slice(0, 8).toUpperCase()} &middot; Citizen: {pickup.user?.name}
            </p>
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
          <p className="text-xs text-neutral-600">
            Please state the exact reason for rejecting this pickup request. This explanation will be visible to the citizen in their mobile app.
          </p>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Reason for rejection *
            </label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Uploaded image does not clearly show recyclable material, or address is outside collection perimeter."
              className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-rose-500 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
              required
            />
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
              disabled={mutation.isPending || !rejectionReason.trim()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Rejecting…" : "Reject Pickup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
