import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRewards, getBadges, getAdminCollectors } from "../api/admin";
import CreateRewardModal from "../components/CreateRewardModal";
import CreateBadgeModal from "../components/CreateBadgeModal";
import CreateCollectorModal from "../components/CreateCollectorModal";
import ErrorState from "../components/ErrorState";
import { CardSkeleton } from "../components/Skeleton";

export default function RewardsBadgesPage() {
  const [activeTab, setActiveTab] = useState("rewards");
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [showCollectorModal, setShowCollectorModal] = useState(false);

  const rewardsQuery = useQuery({ queryKey: ["rewards"], queryFn: getRewards });
  const badgesQuery = useQuery({ queryKey: ["badges"], queryFn: getBadges });
  const collectorsQuery = useQuery({ queryKey: ["admin-collectors"], queryFn: getAdminCollectors });

  const isLoading = rewardsQuery.isLoading || badgesQuery.isLoading || collectorsQuery.isLoading;
  const isError = rewardsQuery.isError || badgesQuery.isError || collectorsQuery.isError;

  const rewards = rewardsQuery.data?.rewards || [];
  const badges = badgesQuery.data?.badges || [];
  const collectors = collectorsQuery.data?.collectors || [];

  return (
    <div className="space-y-6">
      {/* Header with Consistent Primary "Create New" Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Catalogue & Staff Management</h1>
          <p className="text-sm text-neutral-500">
            Manage partner rewards, achievement badges, and collection staff.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeTab === "rewards" && (
            <button
              onClick={() => setShowRewardModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              + Create New Reward
            </button>
          )}

          {activeTab === "badges" && (
            <button
              onClick={() => setShowBadgeModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              + Create New Badge
            </button>
          )}

          {activeTab === "staff" && (
            <button
              onClick={() => setShowCollectorModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              + Create New Collector
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("rewards")}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "rewards"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          🎁 Rewards Catalogue ({rewards.length})
        </button>
        <button
          onClick={() => setActiveTab("badges")}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "badges"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          🏅 Badges & Levels ({badges.length})
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === "staff"
              ? "border-emerald-600 text-emerald-800"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          🚚 Pickup Staff / Collectors ({collectors.length})
        </button>
      </div>

      {isLoading && <CardSkeleton />}
      {isError && (
        <ErrorState
          message="Failed to load items"
          onRetry={() => {
            rewardsQuery.refetch();
            badgesQuery.refetch();
            collectorsQuery.refetch();
          }}
        />
      )}

      {/* REWARDS TAB */}
      {!isLoading && !isError && activeTab === "rewards" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-neutral-900">{r.name}</h3>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                    {r.pointsRequired} pts
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-600 line-clamp-2">
                  {r.description || "Partner reward for Pruthvi eco-citizens."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                <span>Stock remaining:</span>
                <span className={`font-semibold ${r.stock > 10 ? "text-emerald-700" : "text-rose-600"}`}>
                  {r.stock} units
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BADGES TAB */}
      {!isLoading && !isError && activeTab === "badges" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => (
            <div key={b.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏅</span>
                    <h3 className="font-bold text-neutral-900">{b.name}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {b.minPoints}+ pts
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-600">
                  {b.description || `Achieved by reaching ${b.minPoints} Green Points.`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STAFF TAB */}
      {!isLoading && !isError && activeTab === "staff" && (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-neutral-100 text-xs">
            <thead className="bg-neutral-50 text-left font-semibold text-neutral-600">
              <tr>
                <th className="px-4 py-3">Collector Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Active Assigned Pickups</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {collectors.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-semibold text-neutral-900">{c.name}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {c.phone || c.email}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 font-medium uppercase text-[10px] ${
                      c.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {c.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-emerald-700">
                    {c.activeAssignmentsCount} assigned
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showRewardModal && (
        <CreateRewardModal onClose={() => setShowRewardModal(false)} />
      )}
      {showBadgeModal && (
        <CreateBadgeModal onClose={() => setShowBadgeModal(false)} />
      )}
      {showCollectorModal && (
        <CreateCollectorModal onClose={() => setShowCollectorModal(false)} />
      )}
    </div>
  );
}
