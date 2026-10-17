import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { listPickups } from "../api/pickups";
import { useMeta } from "../hooks/useMeta";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { TableSkeleton } from "../components/Skeleton";
import AssignVehicleModal from "../components/AssignVehicleModal";
import RejectPickupModal from "../components/RejectPickupModal";

const STATUS_FILTERS = ["all", "requested", "assigned", "completed", "rejected", "cancelled"];

function formatWasteAndWeight(pickup, wasteTypeLabel) {
  const type = wasteTypeLabel(pickup.wasteType);
  let weight = "";
  if (pickup.wasteQuantity) {
    weight = `${pickup.wasteQuantity} kg`;
  } else if (pickup.quantityBand === "SMALL") {
    weight = "1.5 kg";
  } else if (pickup.quantityBand === "MEDIUM") {
    weight = "3.5 kg";
  } else if (pickup.quantityBand === "LARGE") {
    weight = "7.5 kg";
  }
  return weight ? `${type} · ${weight}` : type;
}

function formatSlotAndDate(slotPeriod, requestedDate, slotPeriodLabel) {
  const fullLabel = slotPeriodLabel(slotPeriod);
  // Strip parenthetical hours (e.g. "Evening (4-7 PM)" -> "Evening")
  const periodName = fullLabel ? fullLabel.replace(/\s*\(.*?\)/, "").trim() : (slotPeriod || "");

  if (!requestedDate) return periodName;
  const d = new Date(requestedDate);
  const formattedDate = !isNaN(d.getTime())
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : "";
  return formattedDate ? `${periodName} · ${formattedDate}` : periodName;
}

export default function PickupQueuePage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [assignPickupTarget, setAssignPickupTarget] = useState(null);
  const [rejectPickupTarget, setRejectPickupTarget] = useState(null);

  const navigate = useNavigate();
  const { wasteTypeLabel, slotPeriodLabel } = useMeta();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pickups", statusFilter],
    queryFn: () => listPickups(statusFilter),
  });

  const pickups = data?.pickups || [];

  // Filter pickups by search term behind the scenes (name, email, phone, address, vehicle, driver)
  const filteredPickups = pickups.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.user?.name?.toLowerCase().includes(q) ||
      p.user?.email?.toLowerCase().includes(q) ||
      p.user?.phone?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.assignments?.[0]?.vehicle?.registrationNo?.toLowerCase().includes(q) ||
      p.assignments?.[0]?.vehicle?.driver?.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Pickup Operations Queue</h1>
          <p className="text-sm text-neutral-500">
            Dispatch collectors, review submitted photos, approve or reject recyclable waste requests.
          </p>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box (searches by email, address, phone behind the scenes) */}
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              placeholder="Search citizen, email, address…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white pl-8 pr-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600 shadow-2xs"
            />
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
              🔍
            </span>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-2xs">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
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
      </div>

      {isLoading && <TableSkeleton />}
      {isError && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading && !isError && pickups.length === 0 && (
        <EmptyState
          title="No pickups found"
          description={`There are currently no pickup requests with status "${statusFilter}".`}
        />
      )}

      {!isLoading && !isError && pickups.length > 0 && filteredPickups.length === 0 && (
        <EmptyState
          title="No matching pickups"
          description={`No pickup requests matched "${searchTerm}".`}
        />
      )}

      {!isLoading && !isError && filteredPickups.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-neutral-100 text-xs text-left">
              <thead className="bg-neutral-50 font-semibold text-neutral-600">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">Citizen</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Waste & Weight</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Slot & Date</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Assigned Staff</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap min-w-[150px] lg:min-w-[180px] xl:min-w-[220px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {filteredPickups.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/queue/${p.id}`)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Citizen: Name only */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div
                        className="font-semibold text-neutral-900 truncate max-w-[160px] lg:max-w-[180px]"
                        title={p.user?.name}
                      >
                        {p.user?.name || "Unknown Citizen"}
                      </div>
                    </td>

                    {/* Waste & Weight: One line */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className="font-medium text-neutral-800 truncate max-w-[180px] lg:max-w-[220px] inline-block align-middle"
                        title={formatWasteAndWeight(p, wasteTypeLabel)}
                      >
                        {formatWasteAndWeight(p, wasteTypeLabel)}
                      </span>
                    </td>

                    {/* Slot & Date: One line */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-neutral-700">
                      <span className="font-medium text-neutral-800">
                        {formatSlotAndDate(p.slotPeriod, p.requestedDate, slotPeriodLabel)}
                      </span>
                    </td>

                    {/* Status: Status chip only with tooltip for rejected reasons */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div
                        className="inline-block"
                        title={
                          p.status === "rejected" && p.rejectionReason
                            ? `Rejection reason: ${p.rejectionReason}`
                            : undefined
                        }
                      >
                        <StatusBadge status={p.status} />
                      </div>
                    </td>

                    {/* Assigned Staff: Vehicle reg & driver name only */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-neutral-700">
                      {p.assignments?.[0]?.vehicle ? (
                        <div className="truncate max-w-[160px] lg:max-w-[180px]">
                          <div className="font-semibold text-emerald-800 flex items-center gap-1.5 truncate">
                            <span>🚛</span>
                            <span className="truncate">{p.assignments[0].vehicle.registrationNo}</span>
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate">
                            {p.assignments[0].vehicle.driver?.name || "Driver Unassigned"}
                          </div>
                        </div>
                      ) : p.assignedAdmin ? (
                        <div className="truncate max-w-[160px]">
                          <div className="font-medium text-neutral-900 truncate">{p.assignedAdmin.name}</div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Actions: Primary Details button + "..." menu */}
                    <td
                      className="px-4 py-3.5 text-right whitespace-nowrap min-w-[150px] lg:min-w-[180px] xl:min-w-[220px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2 flex-nowrap">
                        <Link
                          to={`/queue/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 shadow-2xs whitespace-nowrap flex-shrink-0 transition-colors"
                        >
                          <span>Details</span>
                          <span className="text-neutral-400">→</span>
                        </Link>

                        {/* Dropdown row menu for Reassign and Reject */}
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            title="More actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === p.id ? null : p.id);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shadow-2xs whitespace-nowrap flex-shrink-0 transition-colors"
                          >
                            <span className="text-xs font-bold leading-none tracking-tight">•••</span>
                          </button>

                          {activeMenuId === p.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                }}
                              />
                              <div
                                className={`absolute right-0 z-30 w-44 rounded-xl border border-neutral-200 bg-white p-1 text-left shadow-lg ${
                                  idx >= filteredPickups.length - 2 && filteredPickups.length > 2
                                    ? "bottom-full mb-1"
                                    : "top-full mt-1"
                                }`}
                              >
                                {["requested", "assigned", "on_the_way", "arrived"].includes(p.status) && (
                                  <button
                                    type="button"
                                    disabled={p.status === "on_the_way" || p.status === "arrived"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      setAssignPickupTarget(p);
                                    }}
                                    title={
                                      p.status === "on_the_way" || p.status === "arrived"
                                        ? "Cannot reassign while in transit"
                                        : undefined
                                    }
                                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                                      p.status === "on_the_way" || p.status === "arrived"
                                        ? "text-neutral-300 cursor-not-allowed"
                                        : "text-emerald-700 hover:bg-emerald-50"
                                    }`}
                                  >
                                    <span>🚛</span>
                                    <span>
                                      {p.assignments?.[0] || p.status === "assigned"
                                        ? "Reassign Vehicle"
                                        : "Assign Vehicle"}
                                    </span>
                                  </button>
                                )}

                                {(p.status === "requested" || p.status === "assigned") && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      setRejectPickupTarget(p);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors whitespace-nowrap flex-shrink-0"
                                  >
                                    <span>✕</span>
                                    <span>Reject Request</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    navigate(`/queue/${p.id}`);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors whitespace-nowrap flex-shrink-0"
                                >
                                  <span>📄</span>
                                  <span>Full Details</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {assignPickupTarget && (
        <AssignVehicleModal
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
