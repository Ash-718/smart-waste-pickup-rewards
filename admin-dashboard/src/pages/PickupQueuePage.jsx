import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listPickups, assignPickup } from "../api/pickups";
import { useMeta } from "../hooks/useMeta";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { TableSkeleton } from "../components/Skeleton";

const STATUS_FILTERS = ["all", "requested", "assigned", "completed", "cancelled"];

export default function PickupQueuePage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { wasteTypeLabel, quantityBandLabel, slotPeriodLabel } = useMeta();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pickups", statusFilter],
    queryFn: () => listPickups(statusFilter),
  });

  const assignMutation = useMutation({
    mutationFn: (id) => assignPickup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pickups"] }),
  });

  const pickups = data?.pickups || [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Pickup Queue</h1>
          <p className="text-sm text-neutral-500">View, assign, and track recyclable pickup requests.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-brand-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <TableSkeleton />}
      {isError && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading && !isError && pickups.length === 0 && (
        <EmptyState
          title="No pickups here"
          description="There are no pickup requests matching this filter yet."
        />
      )}

      {!isLoading && !isError && pickups.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Citizen</th>
                <th className="px-4 py-3">Waste Type</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pickups.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{p.user?.name}</div>
                    <div className="text-xs text-neutral-500">{p.user?.email || p.user?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{wasteTypeLabel(p.wasteType)}</td>
                  <td className="px-4 py-3 text-neutral-700">{quantityBandLabel(p.quantityBand)}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {slotPeriodLabel(p.slotPeriod)}
                    <div className="text-xs text-neutral-400">
                      {new Date(p.requestedDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {p.status === "requested" && (
                        <button
                          onClick={() => assignMutation.mutate(p.id)}
                          disabled={assignMutation.isPending}
                          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
                        >
                          Assign to me
                        </button>
                      )}
                      <Link
                        to={`/queue/${p.id}`}
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
