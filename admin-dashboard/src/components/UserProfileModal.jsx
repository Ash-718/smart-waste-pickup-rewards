import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getAdminUserProfile } from "../api/admin";
import StatusBadge from "./StatusBadge";
import ChartTooltip from "./ChartTooltip";
import { CardSkeleton } from "./Skeleton";
import ErrorState from "./ErrorState";

const CATEGORY_COLORS = ["#16a34a", "#2563eb", "#d97706", "#9333ea", "#0891b2", "#64748b"];

export default function UserProfileModal({ userId, onClose }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-user-profile", userId],
    queryFn: () => getAdminUserProfile(userId),
    enabled: !!userId,
  });

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative my-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          ✕
        </button>

        {isLoading && <CardSkeleton />}
        {isError && <ErrorState message={error.message} onRetry={refetch} />}

        {data && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-neutral-900">{data.user.name}</h2>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {data.user.role}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {data.user.email || "No email"} &middot; {data.user.phone || "No phone"}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Registered: {new Date(data.user.createdAt).toLocaleDateString()}
                  {data.metrics.lastPickupDate && (
                    <> &middot; Last Pickup: {new Date(data.metrics.lastPickupDate).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>

            {/* Visual Contribution Summary (KPI Banner) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                User Contribution Summary
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-center">
                  <p className="text-xs font-medium text-emerald-700">Total Waste</p>
                  <p className="mt-1 text-lg font-bold text-emerald-900">{data.metrics.totalWasteKg} kg</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-center">
                  <p className="text-xs font-medium text-neutral-600">Total Pickups</p>
                  <p className="mt-1 text-lg font-bold text-neutral-900">{data.metrics.totalPickups}</p>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center">
                  <p className="text-xs font-medium text-blue-700">Completed</p>
                  <p className="mt-1 text-lg font-bold text-blue-900">{data.metrics.completedPickups}</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-center">
                  <p className="text-xs font-medium text-rose-700">Rejected</p>
                  <p className="mt-1 text-lg font-bold text-rose-900">{data.metrics.rejectedPickups}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-center">
                  <p className="text-xs font-medium text-amber-700">Green Points</p>
                  <p className="mt-1 text-lg font-bold text-amber-900">{data.metrics.totalPointsEarned}</p>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 text-center">
                  <p className="text-xs font-medium text-purple-700">Rewards Used</p>
                  <p className="mt-1 text-lg font-bold text-purple-900">{data.metrics.rewardsRedeemedCount}</p>
                </div>
              </div>
            </div>

            {/* Badges and Rewards Section */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">
                  Badges Earned ({data.badges?.length || 0})
                </h4>
                {data.badges?.length === 0 ? (
                  <p className="text-xs text-neutral-400">No badges unlocked yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data.badges.map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
                      >
                        🏅 {b.name} ({b.minPoints} pts)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">
                  Rewards Redeemed ({data.rewardRedemptions?.length || 0})
                </h4>
                {data.rewardRedemptions?.length === 0 ? (
                  <p className="text-xs text-neutral-400">No rewards redeemed yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {data.rewardRedemptions.map((r) => (
                      <div key={r.id} className="flex justify-between text-xs text-neutral-700">
                        <span className="font-medium text-neutral-900">{r.rewardName}</span>
                        <span className="font-mono text-neutral-500">{r.redemptionCode} ({r.pointsSpent} pts)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* User Charts: Waste over time & Category Distribution */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-neutral-900">Waste Contribution Over Time</h4>
                <p className="text-xs text-neutral-500 mb-3">Kilograms recycled per month</p>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.contributionOverTime || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={30} />
                      <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} kg`} />} />
                      <Bar dataKey="weightKg" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-neutral-900">Waste Category Distribution</h4>
                <p className="text-xs text-neutral-500 mb-3">Breakdown by recyclable type (kg)</p>
                <div className="h-48 w-full flex items-center justify-center">
                  {data.wasteCategoryBreakdown?.every((c) => c.weightKg === 0) ? (
                    <p className="text-xs text-neutral-400">No completed recyclable waste yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.wasteCategoryBreakdown?.filter((c) => c.weightKg > 0) || []}
                          dataKey="weightKg"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={36}
                          paddingAngle={3}
                        >
                          {(data.wasteCategoryBreakdown || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} kg`} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Pickup History Table */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-2">Recent Pickup History</h4>
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="min-w-full divide-y divide-neutral-100 text-xs">
                  <thead className="bg-neutral-50 text-left font-semibold text-neutral-600">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Waste Type</th>
                      <th className="px-3 py-2.5">Quantity</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Collector</th>
                      <th className="px-3 py-2.5">Rejection / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 bg-white">
                    {(data.recentPickups || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-neutral-400">
                          No pickups recorded yet.
                        </td>
                      </tr>
                    ) : (
                      data.recentPickups.map((p) => (
                        <tr key={p.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2 font-medium text-neutral-900">
                            {new Date(p.requestedDate).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-neutral-700">{p.wasteType}</td>
                          <td className="px-3 py-2 text-neutral-700">
                            {p.quantityBand} {p.wasteQuantity ? `(~${p.wasteQuantity}kg)` : ""}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="px-3 py-2 text-neutral-600">
                            {p.assignedAdmin?.name || "—"}
                          </td>
                          <td className="px-3 py-2 text-neutral-500 max-w-xs truncate">
                            {p.status === "rejected" ? (
                              <span className="text-rose-600 font-medium">{p.rejectionReason}</span>
                            ) : (
                              p.address
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
