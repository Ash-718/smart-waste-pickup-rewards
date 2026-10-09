import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import { getMyImpact } from "../api/pickups";
import { colors } from "../theme/colors";

export default function ImpactScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["my-impact"],
    queryFn: getMyImpact,
  });

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand600} />
          <Text style={styles.loadingText}>Calculating your environmental impact…</Text>
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ErrorState message={error.message} onRetry={refetch} />
      </Screen>
    );
  }

  const {
    totalWasteContributed,
    completedPickupsCount,
    totalPointsEarned,
    currentBadge,
    nextBadge,
    wasteCategoryBreakdown = [],
    monthlyContribution = [],
  } = data;

  // Max value for the monthly bar chart
  const maxMonthlyWaste = Math.max(
    ...monthlyContribution.map((m) => m.weightKg || 0),
    1
  );

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <View style={styles.header}>
        <Text style={styles.title}>My Environmental Impact</Text>
        <Text style={styles.subtitle}>
          Your contribution to Pruthvi Zero Waste Foundation
        </Text>
      </View>

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
            <Text style={styles.badgeText}>Next Badge: <Text style={styles.bold}>{nextBadge.name}</Text></Text>
            <Text style={styles.badgeTarget}>{totalPointsEarned} / {nextBadge.minPoints} pts</Text>
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
                ? Math.round((item.weightKg / totalWasteContributed) * 100)
                : 0;

            return (
              <View key={item.wasteType} style={styles.categoryItem}>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryName}>{item.label}</Text>
                  <Text style={styles.categoryValue}>
                    {item.weightKg} kg <Text style={styles.categoryPercent}>({percentage}%)</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    color: colors.neutral500,
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: colors.neutral900,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    alignItems: "center",
    flexBasis: "48%",
    flexGrow: 1,
    paddingVertical: 14,
  },
  kpiEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  kpiValue: {
    color: colors.brand700,
    fontSize: 20,
    fontWeight: "700",
  },
  kpiLabel: {
    color: colors.neutral500,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
  },
  badgeProgressCard: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand200,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badgeText: {
    color: colors.brand800,
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
  },
  sectionTitle: {
    color: colors.neutral900,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: colors.neutral500,
    fontSize: 12,
    marginBottom: 16,
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
});
