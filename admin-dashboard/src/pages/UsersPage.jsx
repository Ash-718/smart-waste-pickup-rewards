import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminUsers } from "../api/admin";
import UserProfileModal from "../components/UserProfileModal";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { TableSkeleton } from "../components/Skeleton";

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: getAdminUsers,
  });

  const users = data?.users || [];

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Registered Citizens</h1>
          <p className="text-sm text-neutral-500">
            Monitor citizen participation, recycling contribution, green points, and badges.
          </p>
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search citizen by name, email, phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {isLoading && <TableSkeleton />}
      {isError && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading && !isError && filteredUsers.length === 0 && (
        <EmptyState
          title="No citizens found"
          description={searchTerm ? "No user matching your search query." : "No registered citizens yet."}
        />
      )}

      {!isLoading && !isError && filteredUsers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-neutral-100 text-xs">
            <thead className="bg-neutral-50 text-left font-semibold text-neutral-600">
              <tr>
                <th className="px-4 py-3">Citizen</th>
                <th className="px-4 py-3">Waste Contributed</th>
                <th className="px-4 py-3">Pickups (Total / Done / Rej)</th>
                <th className="px-4 py-3">Green Points</th>
                <th className="px-4 py-3">Badges & Rewards</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{u.name}</div>
                    <div className="text-neutral-500 text-[11px]">{u.email || u.phone}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-700">
                    {u.totalWasteKg} kg
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    <span className="font-medium text-neutral-900">{u.totalPickups}</span>
                    <span className="text-neutral-400"> (</span>
                    <span className="text-emerald-700 font-medium">{u.completedPickups}</span>
                    <span className="text-neutral-400"> / </span>
                    <span className="text-rose-600 font-medium">{u.rejectedPickups}</span>
                    <span className="text-neutral-400">)</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-amber-700">
                    {u.totalPointsEarned} pts
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    🏅 {u.badgesCount} &middot; 🎁 {u.rewardsRedeemedCount}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {u.lastPickupDate
                      ? new Date(u.lastPickupDate).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedUserId(u.id)}
                      className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                    >
                      View Profile →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
