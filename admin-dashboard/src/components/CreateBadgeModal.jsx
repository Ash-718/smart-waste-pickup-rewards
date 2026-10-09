import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBadge } from "../api/admin";

export default function CreateBadgeModal({ onClose, onCreated }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: createBadge,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      if (onCreated) onCreated(result.badge);
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Failed to create badge");
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Badge name is required");
    const pts = parseInt(minPoints, 10);
    if (!pts || pts <= 0) return setError("Minimum points must be a positive number");

    mutation.mutate({
      name: name.trim(),
      minPoints: pts,
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2 className="text-base font-semibold text-neutral-900">Create New Badge</h2>
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
              Badge Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Platinum Recycler, Eco Champion"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Minimum Points Required *
            </label>
            <input
              type="number"
              min="1"
              value={minPoints}
              onChange={(e) => setMinPoints(e.target.value)}
              placeholder="500"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Awarded to citizens who achieve 500+ Green Points."
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
              {mutation.isPending ? "Creating…" : "Save Badge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
