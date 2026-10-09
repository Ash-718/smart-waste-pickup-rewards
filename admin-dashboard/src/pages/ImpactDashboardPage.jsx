import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  getAnalyticsOverview,
  getAnalyticsTrends,
  getAnalyticsWasteCategories,
} from "../api/admin";
import { useMeta } from "../hooks/useMeta";
import ChartTooltip from "../components/ChartTooltip";
import StatusBadge from "../components/StatusBadge";
import ErrorState from "../components/ErrorState";
import { CardSkeleton } from "../components/Skeleton";
import UserProfileModal from "../components/UserProfileModal";

const TIME_FILTERS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

const CATEGORY_COLORS = ["#16a34a", "#2563eb", "#d97706", "#9333ea", "#0891b2", "#64748b"];

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function ImpactDashboardPage() {
  const [timeRange, setTimeRange] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const { wasteTypeLabel } = useMeta();

  const overviewQuery = useQuery({
    queryKey: ["analytics-overview", timeRange],
    queryFn: () => getAnalyticsOverview(timeRange),
  });

  const trendsQuery = useQuery({
    queryKey: ["analytics-trends", 6],
    queryFn: () => getAnalyticsTrends(6),
  });

  const categoryQuery = useQuery({
    queryKey: ["analytics-categories"],
    queryFn: getAnalyticsWasteCategories,
  });

  const isLoading = overviewQuery.isLoading || trendsQuery.isLoading || categoryQuery.isLoading;
  const isError = overviewQuery.isError || trendsQuery.isError || categoryQuery.isError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMsg =
      overviewQuery.error?.message || trendsQuery.error?.message || categoryQuery.error?.message;
    return (
      <ErrorState
        message={errorMsg}
        onRetry={() => {
          overviewQuery.refetch();
          trendsQuery.refetch();
          categoryQuery.refetch();
        }}
      />
    );
  }

  const overview = overviewQuery.data || {};
  const trends = trendsQuery.data?.monthTrends || [];
  const statusBreakdown = overview.statusBreakdown?.filter((s) => s.count > 0) || [];
  const categories = categoryQuery.data?.categories || [];

  return (
    <div className="space-y-6">
      {/* Top Bar with Time Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Dashboard Overview</h1>
          <p className="text-sm text-neutral-500">
            Real-time recycling operations and community metrics.
          </p>
        </div>

        {/* Filters: Today | This Week | This Month | This Year | All Time */}
        <div className="flex rounded-xl border border-neutral-200 bg-white p-1 shadow-xs">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTimeRange(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                timeRange === f.key
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASHBOARD TOP 4 KPI CARDS (Exact match to Requirement 8) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total Users</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {overview.totalRegisteredUsers?.toLocaleString() || 0}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            <span className="font-semibold text-emerald-700">{overview.activeUsers}</span> active participants
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total Pickups</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">
            {overview.totalPickups?.toLocaleString() || 0}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            <span className="font-semibold text-blue-700">{overview.completedPickups}</span> completed
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Waste Collected</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">
            {overview.totalWasteCollected?.toLocaleString()} KG
          </p>
          <p className="mt-1 text-xs text-emerald-700">Recycled material collected</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Points Distributed</p>
          <p className="mt-2 text-3xl font-bold text-amber-900">
            {overview.totalPointsDistributed?.toLocaleString() || 0}
          </p>
          <p className="mt-1 text-xs text-amber-700">Green Points earned by citizens</p>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Waste Collection Trend (Line/Area Chart) */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Waste Collection Trend"
            subtitle="Recyclable material collected (kg) over recent months"
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="dashWasteGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={35} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} kg`} />} />
                  <Area
                    type="monotone"
                    dataKey="wasteCollectedKg"
                    name="Waste Collected"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#dashWasteGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* Pickup Status (Donut Chart) */}
        <div>
          <ChartCard title="Pickup Status" subtitle="Breakdown of requests by current state">
            <div className="h-64 w-full flex items-center justify-center">
              {statusBreakdown.length === 0 ? (
                <p className="text-xs text-neutral-400">No pickups recorded yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} requests`} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Waste Categories (Bar Chart) */}
      <ChartCard
        title="Waste Categories Collected"
        subtitle="Distribution of collected volume across material categories"
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={35} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} kg`} />} />
              <Bar dataKey="totalKg" name="Total (kg)" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {categories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* TABLES SECTION: RECENT PICKUPS & RECENT USERS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Pickups Table */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900">Recent Pickups</h3>
            <Link to="/queue" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              View queue →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-xs">
              <thead className="bg-neutral-50 text-left font-semibold text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Citizen</th>
                  <th className="px-3 py-2">Waste Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {(overview.recentPickups || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-neutral-400">
                      No pickups recorded.
                    </td>
                  </tr>
                ) : (
                  overview.recentPickups.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-neutral-900">{p.user?.name}</div>
                        <div className="text-[11px] text-neutral-400">
                          {new Date(p.requestedDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-neutral-700">
                        {wasteTypeLabel(p.wasteType)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to={`/queue/${p.id}`}
                          className="rounded-md border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900">Recent Users</h3>
            <Link to="/users" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              View all citizens →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-xs">
              <thead className="bg-neutral-50 text-left font-semibold text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Citizen</th>
                  <th className="px-3 py-2">Registered</th>
                  <th className="px-3 py-2 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {(overview.recentUsers || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-neutral-400">
                      No users registered.
                    </td>
                  </tr>
                ) : (
                  overview.recentUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-neutral-900">{u.name}</div>
                        <div className="text-[11px] text-neutral-400">{u.email || u.phone}</div>
                      </td>
                      <td className="px-3 py-2 text-neutral-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setSelectedUserId(u.id)}
                          className="rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                        >
                          Profile →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
