import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  getAnalyticsOverview,
  getAnalyticsMonthly,
  getAnalyticsTrends,
  getAnalyticsWasteCategories,
} from "../api/admin";
import ChartTooltip from "../components/ChartTooltip";
import ErrorState from "../components/ErrorState";
import { CardSkeleton } from "../components/Skeleton";

const CATEGORY_COLORS = ["#16a34a", "#2563eb", "#d97706", "#9333ea", "#0891b2", "#64748b"];

export default function AnalyticsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  // Queries
  const overviewQuery = useQuery({
    queryKey: ["analytics-overview", "all"],
    queryFn: () => getAnalyticsOverview("all"),
  });

  const monthlyQuery = useQuery({
    queryKey: ["analytics-monthly", selectedYear, selectedMonth],
    queryFn: () => getAnalyticsMonthly(selectedYear, selectedMonth),
  });

  const trendsQuery = useQuery({
    queryKey: ["analytics-trends", 6],
    queryFn: () => getAnalyticsTrends(6),
  });

  const categoryQuery = useQuery({
    queryKey: ["analytics-categories"],
    queryFn: getAnalyticsWasteCategories,
  });

  const isLoading =
    overviewQuery.isLoading ||
    monthlyQuery.isLoading ||
    trendsQuery.isLoading ||
    categoryQuery.isLoading;

  const isError =
    overviewQuery.isError ||
    monthlyQuery.isError ||
    trendsQuery.isError ||
    categoryQuery.isError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMsg =
      overviewQuery.error?.message ||
      monthlyQuery.error?.message ||
      trendsQuery.error?.message ||
      categoryQuery.error?.message;
    return (
      <ErrorState
        message={errorMsg}
        onRetry={() => {
          overviewQuery.refetch();
          monthlyQuery.refetch();
          trendsQuery.refetch();
          categoryQuery.refetch();
        }}
      />
    );
  }

  const overview = overviewQuery.data || {};
  const monthly = monthlyQuery.data || {};
  const trends = trendsQuery.data || { monthTrends: [] };
  const categories = categoryQuery.data || { categories: [] };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Statistical Data & Analytics</h1>
        <p className="text-sm text-neutral-500">
          Comprehensive recycling metrics, trends, and waste composition for Pruthvi Zero Waste Foundation.
        </p>
      </div>

      {/* SECTION A: OVERALL STATISTICS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700">
            A. Overall Platform Statistics (All-Time)
          </h2>
          <span className="text-xs text-neutral-400">Real-time database records</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Waste</span>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{overview.totalWasteCollected} kg</p>
            <span className="text-xs text-emerald-600">Recycled recyclable waste</span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Total Pickups</span>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{overview.totalPickups}</p>
            <span className="text-xs text-neutral-500">Requested across platform</span>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Completed Pickups</span>
            <p className="mt-1 text-2xl font-bold text-blue-900">{overview.completedPickups}</p>
            <span className="text-xs text-blue-600">Successfully collected</span>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Pickups</span>
            <p className="mt-1 text-2xl font-bold text-amber-900">{overview.pendingPickups}</p>
            <span className="text-xs text-amber-600">Awaiting assignment</span>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Rejected Pickups</span>
            <p className="mt-1 text-2xl font-bold text-rose-900">{overview.rejectedPickups}</p>
            <span className="text-xs text-rose-600">With verified reason</span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cancelled Pickups</span>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{overview.cancelledPickups}</p>
            <span className="text-xs text-neutral-500">Cancelled requests</span>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Registered Users</span>
            <p className="mt-1 text-2xl font-bold text-indigo-900">{overview.totalRegisteredUsers}</p>
            <span className="text-xs text-indigo-600">Total citizens</span>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">Active Users</span>
            <p className="mt-1 text-2xl font-bold text-teal-900">{overview.activeUsers}</p>
            <span className="text-xs text-teal-600">Made 1+ pickup request</span>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Green Points</span>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{overview.totalPointsDistributed}</p>
            <span className="text-xs text-emerald-600">Distributed to citizens</span>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">Rewards Redeemed</span>
            <p className="mt-1 text-2xl font-bold text-purple-900">{overview.totalRewardsRedeemed}</p>
            <span className="text-xs text-purple-600">Claimed partner items</span>
          </div>
        </div>
      </section>

      {/* SECTION B: MONTHLY STATISTICS SELECTOR */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              B. Monthly Statistics & Inspector
            </h2>
            <p className="text-xs text-neutral-500">
              Select any month and year to inspect specific collection throughput and engagement.
            </p>
          </div>

          {/* Month / Year Pickers */}
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-emerald-600 focus:outline-hidden"
            >
              {[
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
              ].map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-emerald-600 focus:outline-hidden"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Monthly Metrics Display */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-center">
            <span className="text-xs font-medium text-neutral-500">Waste Collected</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{monthly.totalWasteCollected} kg</p>
            <span className="text-[11px] text-neutral-400">in {monthly.monthName}</span>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-center">
            <span className="text-xs font-medium text-neutral-500">Pickups Total</span>
            <p className="mt-1 text-xl font-bold text-neutral-900">{monthly.totalPickups}</p>
            <span className="text-[11px] text-neutral-400">Requested</span>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-center">
            <span className="text-xs font-medium text-neutral-500">Completed</span>
            <p className="mt-1 text-xl font-bold text-blue-700">{monthly.completedPickups}</p>
            <span className="text-[11px] text-neutral-400">Collected</span>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-center">
            <span className="text-xs font-medium text-neutral-500">Rejected</span>
            <p className="mt-1 text-xl font-bold text-rose-700">{monthly.rejectedPickups}</p>
            <span className="text-[11px] text-neutral-400">Denied</span>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-center">
            <span className="text-xs font-medium text-neutral-500">Points Generated</span>
            <p className="mt-1 text-xl font-bold text-amber-700">{monthly.totalPointsGenerated}</p>
            <span className="text-[11px] text-neutral-400">Green Points</span>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-center">
            <span className="text-xs font-medium text-neutral-500">Active Citizens</span>
            <p className="mt-1 text-xl font-bold text-purple-700">{monthly.activeUsers}</p>
            <span className="text-[11px] text-neutral-400">Participants</span>
          </div>
        </div>
      </section>

      {/* SECTION C: TREND CHARTS */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700">
          C. Historical Month-Wise Trends
        </h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Waste collected month-wise */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900">Waste Collected Month-Wise (kg)</h3>
            <p className="text-xs text-neutral-500 mb-4">Total recyclable volume collected per month</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends.monthTrends}>
                  <defs>
                    <linearGradient id="wasteGrad" x1="0" y1="0" x2="0" y2="1">
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
                    name="Waste (kg)"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#wasteGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pickups month-wise */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900">Pickups Month-Wise (Volume & Outcome)</h3>
            <p className="text-xs text-neutral-500 mb-4">Completed vs Requested vs Rejected pickups</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.monthTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} pickups`} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="totalPickups" name="Total Requested" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completedPickups" name="Completed" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejectedPickups" name="Rejected" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Participation month-wise */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900">Citizen Participation Month-Wise</h3>
            <p className="text-xs text-neutral-500 mb-4">Unique citizens participating in waste pickups</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.monthTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} active users`} />} />
                  <Line
                    type="monotone"
                    dataKey="activeUsers"
                    name="Active Users"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ fill: "#2563eb", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Green Points Distributed month-wise */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900">Green Points Distributed Month-Wise</h3>
            <p className="text-xs text-neutral-500 mb-4">Incentive points credited to citizens</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.monthTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={35} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} pts`} />} />
                  <Bar dataKey="pointsDistributed" name="Green Points" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION D: WASTE CATEGORY ANALYSIS */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700">
          D. Waste Category Analysis
        </h2>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Bar Chart */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900">Waste Collected by Category (kg)</h3>
            <p className="text-xs text-neutral-500 mb-4">Total kg collected per recyclable material type</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categories.categories}
                  layout="vertical"
                  margin={{ left: 10, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} kg`} />} />
                  <Bar dataKey="totalKg" name="Weight (kg)" fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-900">Category Share Percentage</h3>
            <p className="text-xs text-neutral-500 mb-4">Proportion of recyclable types collected</p>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories.categories.filter((c) => c.totalKg > 0)}
                    dataKey="totalKg"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {categories.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} kg`} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Category Data Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-neutral-100 text-xs">
            <thead className="bg-neutral-50 text-left font-semibold text-neutral-600">
              <tr>
                <th className="px-4 py-3">Waste Category</th>
                <th className="px-4 py-3">Completed Pickups</th>
                <th className="px-4 py-3">Total Collected (kg)</th>
                <th className="px-4 py-3">Proportion (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {categories.categories.map((cat, i) => (
                <tr key={cat.wasteType} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    {cat.label}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{cat.pickupCount}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{cat.totalKg} kg</td>
                  <td className="px-4 py-3 text-neutral-600">{cat.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
