import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getDashboardSummary } from "../api/admin";
import { useMeta } from "../hooks/useMeta";
import StatTile from "../components/StatTile";
import ChartTooltip from "../components/ChartTooltip";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { CardSkeleton } from "../components/Skeleton";

const STATUS_ORDER = ["requested", "assigned", "completed", "cancelled"];
const STATUS_COLOR = {
  requested: "#d97706",
  assigned: "#2563eb",
  completed: "#16a34a",
  cancelled: "#737373",
};
const STATUS_LABEL = {
  requested: "Requested",
  assigned: "Assigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

const GRID_STROKE = "#e5e5e5";
const AXIS_TICK = { fill: "#737373", fontSize: 12 };

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function ImpactDashboardPage() {
  const { meta } = useMeta();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  const statusData = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: data.pickupsByStatus.find((s) => s.status === status)?.count || 0,
    fill: STATUS_COLOR[status],
  }));
  const totalPickups = statusData.reduce((sum, s) => sum + s.count, 0);

  const wasteData = (meta?.wasteTypes || []).map((w) => ({
    wasteType: w.value,
    label: w.label,
    count: data.wasteCollectedByType.find((c) => c.wasteType === w.value)?.count || 0,
  }));

  const trendData = data.completedPickupsLast30Days.map((d) => ({
    day: d.day,
    label: formatShortDate(d.day),
    count: d.count,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-neutral-900">Impact Dashboard</h1>
        <p className="text-sm text-neutral-500">
          Program-wide recycling impact, at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total pickups" value={totalPickups} />
        <StatTile label="Green points issued" value={data.totalPointsIssued} />
        <StatTile label="Registered citizens" value={data.totalCitizens} />
        <StatTile label="Rewards redeemed" value={data.totalRedemptions} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Pickups by status" subtitle="All requests, current state">
          {totalPickups === 0 ? (
            <EmptyState title="No pickups yet" description="Requests will appear here once citizens book pickups." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: "#f5f5f5" }}
                  content={<ChartTooltip valueFormatter={(v) => `${v} pickup${v === 1 ? "" : "s"}`} />}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Waste collected by type" subtitle="Completed pickups, all-time">
          {data.wasteCollectedByType.length === 0 ? (
            <EmptyState title="No completed pickups yet" description="Breakdown appears once pickups are marked completed." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={wasteData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: "#f5f5f5" }}
                  content={<ChartTooltip valueFormatter={(v) => `${v} pickup${v === 1 ? "" : "s"}`} />}
                />
                <Bar dataKey="count" fill="#16a34a" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard title="Completed pickups" subtitle="Last 30 days">
          {trendData.length === 0 ? (
            <EmptyState title="No completed pickups in the last 30 days" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} width={32} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} completed`} />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                  activeDot={{ r: 4, fill: "#16a34a", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
