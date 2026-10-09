import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReward } from "../api/admin";

export default function CreateRewardModal({ onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: createReward,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      if (onCreated) onCreated(result.reward);
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Failed to create reward");
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Reward name is required");
    const pts = parseInt(pointsRequired, 10);
    const stk = parseInt(stock, 10);
    if (!pts || pts <= 0) return setError("Points required must be a positive number");
    if (isNaN(stk) || stk < 0) return setError("Stock must be 0 or more");

    mutation.mutate({
      name: name.trim(),
      pointsRequired: pts,
      stock: stk,
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2 className="text-base font-semibold text-neutral-900">Create New Reward</h2>
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
              Reward Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Eco Plant Sapling, Reusable Bottle"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Points Required *
              </label>
              <input
                type="number"
                min="1"
                value={pointsRequired}
                onChange={(e) => setPointsRequired(e.target.value)}
                placeholder="50"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                Initial Stock *
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="100"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details on reward partner or redemption terms."
              className="w-full rounded-lg border border-neutral-300 p-2.5 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
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
              disabled={mutation.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Creating…" : "Save Reward"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
