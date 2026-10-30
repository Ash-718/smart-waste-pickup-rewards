import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import { getMyImpact } from "../api/pickups";
import { getCitizenReport, downloadCitizenReportFile } from "../api/reports";
import { colors } from "../theme/colors";

const PERIODS = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "3 Months" },
  { value: "180d", label: "6 Months" },
  { value: "all", label: "All Time" },
];

export default function ImpactScreen({ route }) {
  const initialView = route?.params?.tab === "reports" ? "reports" : "overview";
  const [activeView, setActiveView] = useState(initialView); // 'overview' | 'reports'
  const [reportPeriod, setReportPeriod] = useState("30d");
  const [downloading, setDownloading] = useState(null); // 'pdf' | 'csv' | null

  // 1. Overview Query
  const overviewQuery = useQuery({
    queryKey: ["my-impact"],
    queryFn: getMyImpact,
  });

  // 2. Reports Query
  const reportsQuery = useQuery({
    queryKey: ["my-reports", reportPeriod],
    queryFn: () => getCitizenReport({ period: reportPeriod }),
    enabled: activeView === "reports",
  });

  const handleDownload = async (type) => {
    try {
      setDownloading(type);
      await downloadCitizenReportFile(type, { period: reportPeriod });
    } catch (err) {
      Alert.alert("Download Error", err.message || "Failed to download report");
    } finally {
      setDownloading(null);
    }
  };

  const isLoading = activeView === "overview" ? overviewQuery.isLoading : reportsQuery.isLoading;
  const isError = activeView === "overview" ? overviewQuery.isError : reportsQuery.isError;
  const error = activeView === "overview" ? overviewQuery.error : reportsQuery.error;
  const refetch = activeView === "overview" ? overviewQuery.refetch : reportsQuery.refetch;
  const isFetching = activeView === "overview" ? overviewQuery.isFetching : reportsQuery.isFetching;

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand600} />
          <Text style={styles.loadingText}>Loading environmental data & reports…</Text>
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState message={error?.message || "Error loading impact"} onRetry={refetch} />
      </Screen>
    );
  }

  const overviewData = overviewQuery.data || {};
  const reportData = reportsQuery.data || {};

  const {
    totalWasteContributed = 0,
    completedPickupsCount = 0,
    totalPointsEarned = 0,
    currentBadge,
    nextBadge,
    wasteCategoryBreakdown = [],
    monthlyContribution = [],
  } = overviewData;

  const maxMonthlyWaste = Math.max(
    ...monthlyContribution.map((m) => m.weightKg || 0),
    1
  );

  const citStats = reportData.pickupStatistics || {};
  const citPoints = reportData.greenPointsAndRewards || {};
  const citImpact = reportData.environmentalImpact || {};
  const historyList = citStats.pickupHistory || [];

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      {/* Header Banner */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {activeView === "overview" ? "My Environmental Impact" : "My Impact Reports"}
        </Text>
        <Text style={styles.subtitle}>
          Verified recycling contributions to Pruthvi Zero Waste Foundation
        </Text>
      </View>

      {/* Segmented Control: Overview vs Downloadable Reports */}
      <View style={styles.segmentedContainer}>
        <Pressable
          style={[styles.segmentBtn, activeView === "overview" && styles.segmentBtnActive]}
          onPress={() => setActiveView("overview")}
        >
          <Text
            style={[
              styles.segmentText,
              activeView === "overview" && styles.segmentTextActive,
            ]}
          >
            🌱 Impact Overview
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, activeView === "reports" && styles.segmentBtnActive]}
          onPress={() => setActiveView("reports")}
        >
          <Text
            style={[
              styles.segmentText,
              activeView === "reports" && styles.segmentTextActive,
            ]}
          >
            📑 Download Reports
          </Text>
        </Pressable>
      </View>

      {/* VIEW 1: OVERVIEW */}
      {activeView === "overview" && (
        <>
          {/* Top Impact Grid */}
          <View style={styles.grid}>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>♻️</Text>
              <Text style={styles.kpiValue}>{totalWasteContributed} kg</Text>
              <Text style={styles.kpiLabel}>Waste Recycled</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>🚚</Text>
              <Text style={styles.kpiValue}>{completedPickupsCount}</Text>
              <Text style={styles.kpiLabel}>Pickups Completed</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>🌱</Text>
              <Text style={styles.kpiValue}>{totalPointsEarned}</Text>
              <Text style={styles.kpiLabel}>Green Points</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>🏅</Text>
              <Text style={styles.kpiValue}>{currentBadge?.name || "Beginner"}</Text>
              <Text style={styles.kpiLabel}>Eco Level</Text>
            </Card>
          </View>

          {/* Next badge progression */}
          {nextBadge && (
            <Card style={styles.badgeProgressCard}>
              <View style={styles.badgeRow}>
                <Text style={styles.badgeText}>
                  Next Badge: <Text style={styles.bold}>{nextBadge.name}</Text>
                </Text>
                <Text style={styles.badgeTarget}>
                  {totalPointsEarned} / {nextBadge.minPoints} pts
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round((totalPointsEarned / nextBadge.minPoints) * 100)
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.badgeHint}>
                Earn {Math.max(0, nextBadge.minPoints - totalPointsEarned)} more points to unlock {nextBadge.name}!
              </Text>
            </Card>
          )}

          {/* Monthly Contribution Graph */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Monthly Recycling Trend</Text>
            <Text style={styles.sectionSubtitle}>Recyclable waste collected (kg) over last 6 months</Text>

            <View style={styles.chartContainer}>
              {monthlyContribution.map((m) => {
                const heightPercent = Math.max(10, Math.round((m.weightKg / maxMonthlyWaste) * 100));
                return (
                  <View key={m.key} style={styles.barCol}>
                    <Text style={styles.barValue}>{m.weightKg}k</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${heightPercent}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{m.monthLabel}</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Waste Category Breakdown */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Waste Category Breakdown</Text>
            <Text style={styles.sectionSubtitle}>Types of recyclables you have contributed</Text>

            <View style={styles.categoryList}>
              {wasteCategoryBreakdown.map((item) => {
                const percentage =
                  totalWasteContributed > 0
                    ? Math.round((item.totalKg / totalWasteContributed) * 100)
                    : 0;
                return (
                  <View key={item.wasteType} style={styles.categoryItem}>
                    <View style={styles.categoryRow}>
                      <Text style={styles.categoryName}>{item.label}</Text>
                      <Text style={styles.categoryValue}>
                        {item.totalKg} kg{" "}
                        <Text style={styles.categoryPercent}>({percentage}%)</Text>
                      </Text>
                    </View>
                    <View style={styles.catBarBg}>
                      <View style={[styles.catBarFill, { width: `${percentage}%` }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}

      {/* VIEW 2: DOWNLOADABLE REPORTS */}
      {activeView === "reports" && (
        <>
          {/* Period Selection Pills */}
          <Card style={styles.filterCard}>
            <Text style={styles.filterTitle}>Select Report Period:</Text>
            <View style={styles.periodRow}>
              {PERIODS.map((p) => (
                <Pressable
                  key={p.value}
                  style={[styles.periodPill, reportPeriod === p.value && styles.periodPillActive]}
                  onPress={() => setReportPeriod(p.value)}
                >
                  <Text
                    style={[
                      styles.periodPillText,
                      reportPeriod === p.value && styles.periodPillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {/* Download Action Buttons */}
          <View style={styles.downloadRow}>
            <Pressable
              style={[styles.downloadBtn, styles.pdfBtn, downloading && styles.btnDisabled]}
              onPress={() => handleDownload("pdf")}
              disabled={downloading !== null}
            >
              <Text style={styles.downloadBtnText}>
                {downloading === "pdf" ? "Generating..." : "📄 Download PDF Report"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.downloadBtn, styles.csvBtn, downloading && styles.btnDisabled]}
              onPress={() => handleDownload("csv")}
              disabled={downloading !== null}
            >
              <Text style={[styles.downloadBtnText, styles.csvBtnText]}>
                {downloading === "csv" ? "Exporting..." : "📊 Export CSV"}
              </Text>
            </Pressable>
          </View>

          {/* Period KPI Summary */}
          <View style={styles.grid}>
            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>🚚</Text>
              <Text style={styles.kpiValue}>{citStats.totalPickups || 0}</Text>
              <Text style={styles.kpiLabel}>Total Requests</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>✅</Text>
              <Text style={styles.kpiValue}>{citStats.completedPickups || 0}</Text>
              <Text style={styles.kpiLabel}>Completed ({citStats.completionRate || 0}%)</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>♻️</Text>
              <Text style={styles.kpiValue}>{citStats.totalVerifiedWasteKg || 0} kg</Text>
              <Text style={styles.kpiLabel}>Verified Recycled</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <Text style={styles.kpiEmoji}>🌱</Text>
              <Text style={styles.kpiValue}>+{citPoints.pointsEarnedInPeriod || 0}</Text>
              <Text style={styles.kpiLabel}>Points in Period</Text>
            </Card>
          </View>

          {/* Environmental Contribution Card */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Verified Environmental Impact</Text>
            <Text style={styles.sectionSubtitle}>
              Measurable contributions verified through WasteWise weighing scales
            </Text>
            <View style={styles.impactDetailBox}>
              <Text style={styles.impactDetailItem}>
                • <Text style={styles.bold}>Landfill Diversion:</Text> Exactly{" "}
                <Text style={styles.bold}>{citImpact.landfillDiversionKg || 0} kg</Text> of recyclables diverted from open dumpsites.
              </Text>
              <Text style={styles.impactDetailItem}>
                • <Text style={styles.bold}>Reliability Score:</Text>{" "}
                {citImpact.civicIndex?.reliableRecyclerRating || "Active Citizen"}.
              </Text>
              <Text style={styles.impactDetailItem}>
                • <Text style={styles.bold}>Active Collection Days:</Text>{" "}
                {citImpact.activeRecyclingDays || 0} days participating in circular recovery.
              </Text>
            </View>
          </Card>

          {/* Waste by Stream Breakdown */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Recycling Streams in Selected Period</Text>
            <View style={styles.categoryList}>
              {citStats.wasteByCategory?.map((cat) => (
                <View key={cat.category} style={styles.categoryItem}>
                  <View style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{cat.label}</Text>
                    <Text style={styles.categoryValue}>
                      {cat.verifiedKg} kg ({cat.count} pickups)
                    </Text>
                  </View>
                  <View style={styles.catBarBg}>
                    <View style={[styles.catBarFill, { width: `${cat.percentage}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {/* Pickup History Log */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Pickup Log ({historyList.length})</Text>
            <Text style={styles.sectionSubtitle}>Detailed records for this reporting period</Text>

            {historyList.length === 0 ? (
              <Text style={styles.emptyText}>No pickups recorded in this period.</Text>
            ) : (
              <View style={styles.historyList}>
                {historyList.map((p) => (
                  <View key={p.id} style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyCategory}>{p.categoryLabel}</Text>
                      <Text style={styles.historyDate}>{p.date} • {p.quantityBand}</Text>
                      <Text style={styles.historyAddress} numberOfLines={1}>
                        📍 {p.address}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text
                        style={[
                          styles.historyStatus,
                          p.status === "completed"
                            ? styles.statusCompleted
                            : p.status === "rejected"
                            ? styles.statusRejected
                            : styles.statusPending,
                        ]}
                      >
                        {p.status.toUpperCase()}
                      </Text>
                      {p.wasteQuantityKg !== null && (
                        <Text style={styles.historyKg}>{p.wasteQuantityKg} kg</Text>
                      )}
                      {p.pointsEarned > 0 && (
                        <Text style={styles.historyPts}>+{p.pointsEarned} pts</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.neutral500,
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    color: colors.neutral900,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 3,
  },
  segmentedContainer: {
    backgroundColor: colors.neutral100,
    borderRadius: 14,
    flexDirection: "row",
    marginBottom: 16,
    padding: 4,
  },
  segmentBtn: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    paddingVertical: 9,
  },
  segmentBtnActive: {
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    color: colors.neutral600,
    fontSize: 12,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: colors.brand800,
    fontWeight: "700",
  },
  filterCard: {
    marginBottom: 12,
    padding: 12,
  },
  filterTitle: {
    color: colors.neutral600,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  periodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  periodPill: {
    backgroundColor: colors.neutral100,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  periodPillActive: {
    backgroundColor: colors.brand700,
  },
  periodPillText: {
    color: colors.neutral700,
    fontSize: 11,
    fontWeight: "600",
  },
  periodPillTextActive: {
    color: colors.white,
  },
  downloadRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  downloadBtn: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  pdfBtn: {
    backgroundColor: colors.brand700,
  },
  csvBtn: {
    backgroundColor: colors.white,
    borderColor: colors.neutral300,
    borderWidth: 1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  downloadBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  csvBtnText: {
    color: colors.neutral800,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flexBasis: "48%",
    flexGrow: 1,
    padding: 14,
  },
  kpiEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  kpiValue: {
    color: colors.neutral900,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  kpiLabel: {
    color: colors.neutral500,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  badgeProgressCard: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand200,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badgeText: {
    color: colors.brand900,
    fontSize: 13,
  },
  bold: {
    fontWeight: "700",
  },
  badgeTarget: {
    color: colors.brand700,
    fontSize: 12,
    fontWeight: "600",
  },
  progressBarBg: {
    backgroundColor: colors.brand200,
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    backgroundColor: colors.brand600,
    borderRadius: 999,
    height: "100%",
  },
  badgeHint: {
    color: colors.brand800,
    fontSize: 11,
    marginTop: 6,
  },
  sectionCard: {
    marginBottom: 14,
    padding: 14,
  },
  sectionTitle: {
    color: colors.neutral900,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: colors.neutral500,
    fontSize: 12,
    marginBottom: 14,
    marginTop: 2,
  },
  chartContainer: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: 140,
    justifyContent: "space-between",
    paddingTop: 10,
  },
  barCol: {
    alignItems: "center",
    flex: 1,
  },
  barValue: {
    color: colors.neutral500,
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
  },
  barTrack: {
    alignItems: "center",
    backgroundColor: colors.neutral100,
    borderRadius: 6,
    height: 90,
    justifyContent: "flex-end",
    width: 22,
  },
  barFill: {
    backgroundColor: colors.brand600,
    borderRadius: 6,
    width: "100%",
  },
  barLabel: {
    color: colors.neutral600,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
  },
  categoryList: {
    gap: 12,
  },
  categoryItem: {
    gap: 4,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryName: {
    color: colors.neutral800,
    fontSize: 13,
    fontWeight: "500",
  },
  categoryValue: {
    color: colors.neutral900,
    fontSize: 13,
    fontWeight: "600",
  },
  categoryPercent: {
    color: colors.neutral400,
    fontSize: 11,
    fontWeight: "400",
  },
  catBarBg: {
    backgroundColor: colors.neutral100,
    borderRadius: 999,
    height: 6,
    overflow: "hidden",
  },
  catBarFill: {
    backgroundColor: colors.brand600,
    borderRadius: 999,
    height: "100%",
  },
  impactDetailBox: {
    backgroundColor: colors.neutral50,
    borderRadius: 10,
    gap: 8,
    padding: 12,
  },
  impactDetailItem: {
    color: colors.neutral700,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyText: {
    color: colors.neutral400,
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 10,
    textAlign: "center",
  },
  historyList: {
    gap: 10,
  },
  historyItem: {
    backgroundColor: colors.neutral50,
    borderColor: colors.neutral200,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
  },
  historyLeft: {
    flex: 1,
    marginRight: 8,
  },
  historyCategory: {
    color: colors.neutral900,
    fontSize: 13,
    fontWeight: "700",
  },
  historyDate: {
    color: colors.neutral500,
    fontSize: 11,
    marginTop: 2,
  },
  historyAddress: {
    color: colors.neutral400,
    fontSize: 10,
    marginTop: 2,
  },
  historyRight: {
    alignItems: "flex-end",
  },
  historyStatus: {
    borderRadius: 6,
    fontSize: 9,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusCompleted: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusPending: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  statusRejected: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  historyKg: {
    color: colors.neutral800,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  historyPts: {
    color: colors.brand700,
    fontSize: 10,
    fontWeight: "700",
  },
});
