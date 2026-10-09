import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listPickups } from "../api/pickups";
import { useMeta } from "../hooks/useMeta";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { TableSkeleton } from "../components/Skeleton";
import AssignCollectorModal from "../components/AssignCollectorModal";
import RejectPickupModal from "../components/RejectPickupModal";

const STATUS_FILTERS = ["all", "requested", "assigned", "completed", "rejected", "cancelled"];

export default function PickupQueuePage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignPickupTarget, setAssignPickupTarget] = useState(null);
  const [rejectPickupTarget, setRejectPickupTarget] = useState(null);

  const { wasteTypeLabel, quantityBandLabel, slotPeriodLabel } = useMeta();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pickups", statusFilter],
    queryFn: () => listPickups(statusFilter),
  });

  const pickups = data?.pickups || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Pickup Operations Queue</h1>
          <p className="text-sm text-neutral-500">
            Dispatch collectors, review submitted photos, approve or reject recyclable waste requests.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-xs">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
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
          title="No pickups found"
          description={`There are currently no pickup requests with status "${statusFilter}".`}
        />
      )}

      {!isLoading && !isError && pickups.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-neutral-100 text-xs">
            <thead className="bg-neutral-50 text-left font-semibold text-neutral-600">
              <tr>
                <th className="px-4 py-3">Citizen</th>
                <th className="px-4 py-3">Waste & Weight</th>
                <th className="px-4 py-3">Slot & Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned Staff</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {pickups.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{p.user?.name}</div>
                    <div className="text-[11px] text-neutral-500">{p.user?.email || p.user?.phone}</div>
                    <div className="text-[11px] text-neutral-400 truncate max-w-xs">{p.address}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-800">{wasteTypeLabel(p.wasteType)}</div>
                    <div className="text-neutral-500 text-[11px]">
                      {quantityBandLabel(p.quantityBand)}
                      {p.wasteQuantity ? ` (${p.wasteQuantity} kg)` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    <div className="font-medium text-neutral-800">{slotPeriodLabel(p.slotPeriod)}</div>
                    <div className="text-neutral-400 text-[11px]">
                      {new Date(p.requestedDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                    {p.status === "rejected" && p.rejectionReason && (
                      <div className="mt-1 max-w-xs text-[11px] text-rose-600 truncate" title={p.rejectionReason}>
                        Reason: {p.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {p.assignedAdmin ? (
                      <div>
                        <span className="font-medium text-neutral-900">{p.assignedAdmin.name}</span>
                        {p.assignedAt && (
                          <div className="text-[10px] text-neutral-400">
                            {new Date(p.assignedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-1.5">
                      {(p.status === "requested" || p.status === "assigned") && (
                        <button
                          onClick={() => setAssignPickupTarget(p)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          {p.status === "assigned" ? "Reassign" : "Assign"}
                        </button>
                      )}

                      {(p.status === "requested" || p.status === "assigned") && (
                        <button
                          onClick={() => setRejectPickupTarget(p)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                        >
                          Reject
                        </button>
                      )}

                      <Link
                        to={`/queue/${p.id}`}
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                      >
                        Details →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {assignPickupTarget && (
        <AssignCollectorModal
          pickup={assignPickupTarget}
          onClose={() => setAssignPickupTarget(null)}
          onAssigned={() => refetch()}
        />
      )}

      {rejectPickupTarget && (
        <RejectPickupModal
          pickup={rejectPickupTarget}
          onClose={() => setRejectPickupTarget(null)}
          onRejected={() => refetch()}
        />
      )}
    </div>
  );
}
