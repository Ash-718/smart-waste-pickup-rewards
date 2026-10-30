import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAdminReports,
  downloadAdminPdfReport,
  downloadAdminCsvReport,
  downloadAdminExcelReport,
} from "../api/reports";

const PERIOD_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 3 Months" },
  { value: "180d", label: "Last 6 Months" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "PLASTIC", label: "Plastic" },
  { value: "PAPER_CARDBOARD", label: "Paper & Cardboard" },
  { value: "METAL", label: "Metal" },
  { value: "GLASS", label: "Glass" },
  { value: "E_WASTE", label: "E-Waste" },
  { value: "MIXED_RECYCLABLES", label: "Mixed Recyclables" },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [category, setCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("pickups"); // 'pickups', 'waste', 'fleet', 'citizens', 'rewards', 'records'

  const [downloading, setDownloading] = useState(null); // 'pdf' | 'csv' | 'excel' | null
  const [downloadError, setDownloadError] = useState(null);

  // Active query parameters
  const queryParams = {
    period,
    ...(period === "custom" && startDate && endDate ? { startDate, endDate } : {}),
    ...(category !== "all" ? { category } : {}),
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["adminReports", queryParams],
    queryFn: () => getAdminReports(queryParams),
    refetchOnWindowFocus: false,
  });

  const handleDownload = async (type) => {
    try {
      setDownloading(type);
      setDownloadError(null);
      if (type === "pdf") {
        await downloadAdminPdfReport(queryParams);
      } else if (type === "csv") {
        await downloadAdminCsvReport(queryParams);
      } else if (type === "excel") {
        await downloadAdminExcelReport(queryParams);
      }
    } catch (err) {
      setDownloadError(err.message || "Failed to download report file");
    } finally {
      setDownloading(null);
    }
  };

  const pickup = data?.pickupAnalytics;
  const waste = data?.wasteCollectionAnalytics;
  const fleet = data?.fleetAnalytics;
  const citizen = data?.citizenAnalytics;
  const rewards = data?.rewardsAnalytics;
  const records = data?.pickupRecords || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
            <span>📑</span> Reports & Analytics
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Generate and export verified municipal waste data, fleet telemetry metrics, and citizen impact reports.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleDownload("pdf")}
            disabled={downloading !== null || isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-all cursor-pointer"
          >
            {downloading === "pdf" ? <span className="animate-spin">⏳</span> : <span>📄</span>}
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => handleDownload("csv")}
            disabled={downloading !== null || isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 shadow-2xs hover:bg-neutral-50 disabled:opacity-50 transition-all cursor-pointer"
          >
            {downloading === "csv" ? <span className="animate-spin">⏳</span> : <span>📊</span>}
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleDownload("excel")}
            disabled={downloading !== null || isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 disabled:opacity-50 transition-all cursor-pointer"
          >
            {downloading === "excel" ? <span className="animate-spin">⏳</span> : <span>📑</span>}
            Download Excel (.xlsx)
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>⚠️ {downloadError}</span>
          <button type="button" onClick={() => setDownloadError(null)} className="font-bold underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Period Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-neutral-500 mr-1">Timeframe:</span>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                period === opt.value
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-neutral-500">Stream:</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Inputs (when 'custom' is selected) */}
      {period === "custom" && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-neutral-600">Start Date:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800"
          />
          <span className="text-xs font-semibold text-neutral-600">End Date:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800"
          />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={!startDate || !endDate}
            className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
          >
            Apply Filter
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <div className="text-sm font-semibold text-neutral-800">Generating analytics report...</div>
          <div className="text-xs text-neutral-400 mt-1">Aggregating database pickups, fleet telemetry and Green Points</div>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div className="text-red-700 font-bold text-sm">Failed to load analytics report</div>
          <div className="text-xs text-red-500 mt-1">{error.message}</div>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Executive KPI Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Total Pickups</div>
              <div className="text-2xl font-black text-neutral-900 mt-1">{pickup?.totalPickups || 0}</div>
              <div className="text-[11px] font-semibold text-emerald-700 mt-1">
                {pickup?.completionRate || 0}% Completed ({pickup?.completedPickups || 0})
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Verified Waste</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">{waste?.totalVerifiedWasteKg || 0} kg</div>
              <div className="text-[11px] text-neutral-500 mt-1">100% Landfill Diverted</div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Fleet Assets</div>
              <div className="text-2xl font-black text-neutral-900 mt-1">{fleet?.totalVehicles || 0}</div>
              <div className="text-[11px] font-semibold text-blue-700 mt-1">
                {fleet?.activeVehiclesCount || 0} Active • {fleet?.fleetUtilizationRate || 0}% Utilized
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Citizen Engagement</div>
              <div className="text-2xl font-black text-neutral-900 mt-1">{citizen?.activeCitizensCount || 0}</div>
              <div className="text-[11px] text-neutral-500 mt-1">
                of {citizen?.totalRegisteredCitizens || 0} Registered ({citizen?.citizenParticipationRate || 0}%)
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Green Points</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">+{citizen?.pointsDistributedInPeriod || 0}</div>
              <div className="text-[11px] text-neutral-500 mt-1">
                {citizen?.totalRedemptionsCount || 0} Redemptions ({citizen?.totalPointsRedeemed || 0} pts)
              </div>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="border-b border-neutral-200">
            <nav className="flex space-x-4">
              {[
                { id: "pickups", label: "Pickup Analytics", icon: "🚚" },
                { id: "waste", label: "Waste Collection", icon: "♻️" },
                { id: "fleet", label: "Fleet & Collectors", icon: "🚛" },
                { id: "citizens", label: "Citizen Activity", icon: "👥" },
                { id: "rewards", label: "Rewards & Badges", icon: "🎁" },
                { id: "records", label: `Detailed Records (${records.length})`, icon: "📋" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === tab.id
                      ? "border-emerald-600 text-emerald-900"
                      : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab 1: Pickup Analytics */}
          {activeTab === "pickups" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs text-neutral-500 font-semibold">Completed Pickups</div>
                  <div className="text-xl font-bold text-emerald-700 mt-1">{pickup?.completedPickups || 0}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">{pickup?.completionRate}% of requests</div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs text-neutral-500 font-semibold">Pending / In-Transit</div>
                  <div className="text-xl font-bold text-amber-600 mt-1">{pickup?.pendingPickups || 0}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Assigned or on the way</div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs text-neutral-500 font-semibold">Rejected by Staff</div>
                  <div className="text-xl font-bold text-red-600 mt-1">{pickup?.rejectedPickups || 0}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Contaminated / inaccessible</div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs text-neutral-500 font-semibold">Cancelled by Citizen</div>
                  <div className="text-xl font-bold text-neutral-500 mt-1">{pickup?.cancelledPickups || 0}</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Withdrawn requests</div>
                </div>
              </div>

              {/* Category Breakdown Cards */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-neutral-900 mb-3">Category Distribution in Period</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {pickup?.categoryDistribution?.map((cat) => (
                    <div key={cat.category} className="p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="text-xs font-bold text-neutral-800 truncate">{cat.label}</div>
                      <div className="text-lg font-extrabold text-emerald-800 mt-1">{cat.count}</div>
                      <div className="text-[10px] text-neutral-500">{cat.verifiedKg} kg verified</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Waste Collection Analytics */}
          {activeTab === "waste" && (
            <div className="space-y-5">
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-900">Verified Waste Stream Recovery</h3>
                  <span className="text-xs font-semibold text-emerald-700">
                    Total: {waste?.totalVerifiedWasteKg} kg
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-5 py-3">Waste Category</th>
                      <th className="px-4 py-3 text-right">Pickups Count</th>
                      <th className="px-4 py-3 text-right">Verified Weight (kg)</th>
                      <th className="px-5 py-3 text-right">Stream Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {waste?.wasteByCategory?.map((cat) => (
                      <tr key={cat.category} className="hover:bg-neutral-50">
                        <td className="px-5 py-3 font-semibold text-neutral-800">{cat.label}</td>
                        <td className="px-4 py-3 text-right text-neutral-600">{cat.count}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-800">{cat.verifiedKg} kg</td>
                        <td className="px-5 py-3 text-right text-neutral-700 font-semibold">{cat.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Fleet & Collectors */}
          {activeTab === "fleet" && (
            <div className="space-y-5">
              {/* Collector Performance Table */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-neutral-100">
                  <h3 className="text-sm font-bold text-neutral-900">Collector Operational Performance</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-5 py-3">Collector Name</th>
                      <th className="px-4 py-3">Assigned Truck</th>
                      <th className="px-4 py-3 text-right">Assigned Jobs</th>
                      <th className="px-4 py-3 text-right">Completed Jobs</th>
                      <th className="px-4 py-3 text-right">Success Rate (%)</th>
                      <th className="px-5 py-3 text-right">Total Waste (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {waste?.collectorPerformance?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-5 py-6 text-center text-neutral-400">
                          No collector job activity recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      waste?.collectorPerformance?.map((c) => (
                        <tr key={c.collectorId} className="hover:bg-neutral-50">
                          <td className="px-5 py-3 font-semibold text-neutral-800">
                            <div>{c.name}</div>
                            <div className="text-[10px] text-neutral-400 font-normal">{c.email}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] font-semibold text-blue-800">
                            {c.vehicleReg}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-600">{c.assignedPickupsCount}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-800">{c.completedPickupsCount}</td>
                          <td className="px-4 py-3 text-right font-semibold text-neutral-700">{c.successRate}%</td>
                          <td className="px-5 py-3 text-right font-black text-emerald-900">{c.totalWasteCollectedKg} kg</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Fleet Asset Roster */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-900">Fleet Assets Roster</h3>
                  <span className="text-xs font-semibold text-neutral-500">
                    Utilization: {fleet?.fleetUtilizationRate}%
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-5 py-3">Registration No</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Assigned Driver</th>
                      <th className="px-5 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {fleet?.fleetRoster?.map((v) => (
                      <tr key={v.id} className="hover:bg-neutral-50">
                        <td className="px-5 py-3 font-bold font-mono text-neutral-900">{v.registrationNo}</td>
                        <td className="px-4 py-3 text-neutral-600">{v.type}</td>
                        <td className="px-4 py-3 text-neutral-600">{v.capacityKg} kg</td>
                        <td className="px-4 py-3 text-neutral-800 font-medium">{v.collectorName}</td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.isActive ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"
                            }`}
                          >
                            {v.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 4: Citizen Activity */}
          {activeTab === "citizens" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs">
                  <div className="text-xs font-semibold text-neutral-500">Citizen Participation Rate</div>
                  <div className="text-2xl font-black text-emerald-800 mt-1">{citizen?.citizenParticipationRate}%</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {citizen?.activeCitizensCount} of {citizen?.totalRegisteredCitizens} citizens actively recycling
                  </div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs">
                  <div className="text-xs font-semibold text-neutral-500">Green Points Issued in Period</div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">+{citizen?.pointsDistributedInPeriod}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    All-Time Points Distributed: {citizen?.allTimePointsDistributed} pts
                  </div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs">
                  <div className="text-xs font-semibold text-neutral-500">Rewards Redeemed by Citizens</div>
                  <div className="text-2xl font-black text-neutral-900 mt-1">{citizen?.totalRedemptionsCount}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Total Points Spent: {citizen?.totalPointsRedeemed} pts
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Rewards & Badges */}
          {activeTab === "rewards" && (
            <div className="space-y-5">
              {/* Reward Items Stock & Popularity */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-neutral-100">
                  <h3 className="text-sm font-bold text-neutral-900">Reward Items Stock & Redemption Popularity</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-5 py-3">Reward Title</th>
                      <th className="px-4 py-3 text-right">Points Cost</th>
                      <th className="px-4 py-3 text-right">Available Stock</th>
                      <th className="px-5 py-3 text-right">Total Redemptions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rewards?.rewardCatalogue?.map((r) => (
                      <tr key={r.id} className="hover:bg-neutral-50">
                        <td className="px-5 py-3 font-semibold text-neutral-800">{r.name}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-800">{r.pointsRequired} pts</td>
                        <td className="px-4 py-3 text-right text-neutral-700 font-semibold">{r.stock}</td>
                        <td className="px-5 py-3 text-right font-bold text-blue-800">{r.redemptionsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Badge Distribution */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-neutral-900 mb-3">Citizen Badge Level Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {rewards?.badgeDistribution?.map((b) => (
                    <div key={b.name} className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-neutral-800 text-sm">{b.name} Badge</div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {b.minPoints}+ pts
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-neutral-900 mt-2">{b.unlockedCount}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">Citizens Unlocked</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: Detailed Pickup Records Log */}
          {activeTab === "records" && (
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900">Detailed Pickup Records</h3>
                <span className="text-xs text-neutral-500 font-medium">Showing {records.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Citizen</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Quantity Band</th>
                      <th className="px-4 py-3 text-right">Weight (kg)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Collector</th>
                      <th className="px-4 py-3">Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-5 py-6 text-center text-neutral-400">
                          No pickups match the selected date and category filters.
                        </td>
                      </tr>
                    ) : (
                      records.map((p) => (
                        <tr key={p.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-2.5 text-neutral-600">{p.date}</td>
                          <td className="px-4 py-2.5 font-semibold text-neutral-800">
                            <div>{p.citizenName}</div>
                            <div className="text-[10px] text-neutral-400 font-normal">{p.citizenPhone}</div>
                          </td>
                          <td className="px-4 py-2.5 font-medium text-neutral-700">{p.categoryLabel}</td>
                          <td className="px-4 py-2.5 text-neutral-600">{p.quantityBand}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-800">
                            {p.wasteQuantityKg !== null ? `${p.wasteQuantityKg} kg` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : p.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : p.status === "cancelled"
                                  ? "bg-neutral-100 text-neutral-600"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {p.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-neutral-700">{p.vehicleReg}</td>
                          <td className="px-4 py-2.5 text-neutral-600">{p.collectorName}</td>
                          <td className="px-4 py-2.5 text-neutral-500 max-w-xs truncate">{p.address}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
