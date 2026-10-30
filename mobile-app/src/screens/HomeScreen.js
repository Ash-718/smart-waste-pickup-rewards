import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../hooks/useMeta";
import { getBalance } from "../api/points";
import { listPickups, getMyImpact } from "../api/pickups";
import { colors } from "../theme/colors";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { wasteTypeLabel, quantityBandLabel } = useMeta();

  const balanceQuery = useQuery({ queryKey: ["points-balance"], queryFn: getBalance });
  const pickupsQuery = useQuery({ queryKey: ["pickups", "all"], queryFn: () => listPickups() });
  const impactQuery = useQuery({ queryKey: ["my-impact"], queryFn: getMyImpact });

  const recentPickups = (pickupsQuery.data?.pickups || []).slice(0, 4);
  const reminder = balanceQuery.data?.reminder;
  const impact = impactQuery.data || {};
  const thisMonth = impact.thisMonth || {};

  return (
    <Screen
      onRefresh={() => {
        balanceQuery.refetch();
        pickupsQuery.refetch();
        impactQuery.refetch();
      }}
      refreshing={balanceQuery.isFetching || pickupsQuery.isFetching || impactQuery.isFetching}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(" ")[0] || "Eco Citizen"}</Text>
          <Text style={styles.subtitle}>Pruthvi Zero Waste Foundation</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      {/* Reminder Notification */}
      {reminder?.due && (
        <Card style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>⏰ Time for another pickup?</Text>
          <Text style={styles.reminderBody}>
            It's been {reminder.daysSinceLastPickup} days since your last completed pickup. Schedule one today!
          </Text>
        </Card>
      )}

      {/* Environmental Impact Summary Card */}
      <Card style={styles.impactCard}>
        <View style={styles.impactHeader}>
          <Text style={styles.impactCardTitle}>Environmental Impact</Text>
          <Text style={styles.impactCardBadge}>
            🏅 {impact.currentBadge?.name || "Eco Citizen"}
          </Text>
        </View>

        <View style={styles.impactStatsRow}>
          <View style={styles.impactCol}>
            <Text style={styles.impactValue}>{impact.totalWasteContributed || 0} kg</Text>
            <Text style={styles.impactLabel}>Waste Recycled</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactCol}>
            <Text style={styles.impactValue}>{impact.completedPickupsCount || 0}</Text>
            <Text style={styles.impactLabel}>Pickups Done</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactCol}>
            <Text style={styles.impactValue}>{impact.availablePoints ?? (balanceQuery.data?.balance || 0)}</Text>
            <Text style={styles.impactLabel}>Green Points</Text>
          </View>
        </View>
      </Card>

      {/* Quick Action Button */}
      <View style={styles.cta}>
        <Button title="+ Book a Pickup" onPress={() => navigation.navigate("BookPickup")} />
      </View>

      {/* "Your Impact This Month" Section */}
      <Card style={styles.monthCard}>
        <View style={styles.monthHeader}>
          <View>
            <Text style={styles.monthSectionTitle}>Your Impact This Month</Text>
            <Text style={styles.monthSubtitle}>
              {thisMonth.fullMonthLabel || "Current Month"} activity
            </Text>
          </View>
          <Pressable
            style={styles.impactDetailsBtn}
            onPress={() => navigation.navigate("Impact", { tab: "reports" })}
          >
            <Text style={styles.impactDetailsText}>Full Report →</Text>
          </Pressable>
        </View>

        <View style={styles.monthStatsRow}>
          <View style={styles.monthStatItem}>
            <Text style={styles.monthStatNum}>{thisMonth.weightKg || 0} kg</Text>
            <Text style={styles.monthStatLabel}>Recycled</Text>
          </View>
          <View style={styles.monthStatItem}>
            <Text style={styles.monthStatNum}>{thisMonth.completedCount || 0}</Text>
            <Text style={styles.monthStatLabel}>Completed</Text>
          </View>
          <View style={styles.monthStatItem}>
            <Text style={styles.monthStatNum}>+{thisMonth.pointsEarned || 0}</Text>
            <Text style={styles.monthStatLabel}>Points Earned</Text>
          </View>
        </View>
      </Card>

      {/* Recent Pickups Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent pickups</Text>
        <Pressable onPress={() => navigation.navigate("Pickups")}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>

      {recentPickups.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No pickups yet. Book your first one above to start earning rewards!</Text>
        </Card>
      ) : (
        recentPickups.map((pickup) => (
          <Pressable
            key={pickup.id}
            onPress={() => navigation.navigate("PickupDetail", { id: pickup.id })}
          >
            <Card style={styles.pickupCard}>
              <View style={styles.pickupRow}>
                <Text style={styles.pickupType}>{wasteTypeLabel(pickup.wasteType)}</Text>
                <StatusBadge status={pickup.status} />
              </View>

              <Text style={styles.pickupMeta}>
                {quantityBandLabel(pickup.quantityBand)} · {new Date(pickup.requestedDate).toLocaleDateString()}
              </Text>

              {pickup.status === "assigned" && pickup.assignedAdmin && (
                <View style={[styles.assignedNotice, { flexDirection: "row", alignItems: "center" }]}>
                  <Ionicons name="person" size={13} color={colors.neutral700} style={{ marginRight: 5 }} />
                  <Text style={styles.assignedNoticeText} numberOfLines={1}>
                    Collector: {pickup.assignedAdmin.name}
                  </Text>
                </View>
              )}

              {pickup.status === "rejected" && pickup.rejectionReason && (
                <View style={styles.rejectionNotice}>
                  <Text style={styles.rejectionNoticeText} numberOfLines={2}>
                    Reason: {pickup.rejectionReason}
                  </Text>
                </View>
              )}
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greeting: {
    color: colors.neutral900,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: colors.neutral100,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logout: {
    color: colors.neutral600,
    fontSize: 12,
    fontWeight: "600",
  },
  reminderCard: {
    backgroundColor: colors.amber50,
    borderColor: colors.amber600,
    marginBottom: 12,
  },
  reminderTitle: {
    color: colors.amber700,
    fontSize: 14,
    fontWeight: "700",
  },
  reminderBody: {
    color: colors.amber700,
    fontSize: 13,
    marginTop: 2,
  },
  impactCard: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand200,
    marginBottom: 16,
    padding: 16,
  },
  impactHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  impactCardTitle: {
    color: colors.brand800,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  impactCardBadge: {
    backgroundColor: colors.white,
    borderColor: colors.brand200,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.brand700,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  impactStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  impactCol: {
    alignItems: "center",
    flex: 1,
  },
  impactValue: {
    color: colors.brand800,
    fontSize: 18,
    fontWeight: "700",
  },
  impactLabel: {
    color: colors.brand700,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  impactDivider: {
    backgroundColor: colors.brand200,
    height: "80%",
    width: 1,
  },
  cta: {
    marginBottom: 16,
  },
  monthCard: {
    marginBottom: 20,
    padding: 16,
  },
  monthHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthSectionTitle: {
    color: colors.neutral900,
    fontSize: 15,
    fontWeight: "700",
  },
  monthSubtitle: {
    color: colors.neutral500,
    fontSize: 12,
    marginTop: 2,
  },
  impactDetailsBtn: {
    backgroundColor: colors.neutral100,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  impactDetailsText: {
    color: colors.brand700,
    fontSize: 12,
    fontWeight: "600",
  },
  monthStatsRow: {
    backgroundColor: colors.neutral50,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
  },
  monthStatItem: {
    alignItems: "center",
  },
  monthStatNum: {
    color: colors.neutral900,
    fontSize: 15,
    fontWeight: "700",
  },
  monthStatLabel: {
    color: colors.neutral500,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.neutral900,
    fontSize: 15,
    fontWeight: "700",
  },
  link: {
    color: colors.brand700,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.neutral500,
    fontSize: 13,
    lineHeight: 18,
  },
  pickupCard: {
    marginBottom: 10,
  },
  pickupRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pickupType: {
    color: colors.neutral900,
    fontSize: 14,
    fontWeight: "600",
  },
  pickupMeta: {
    color: colors.neutral500,
    fontSize: 12,
    marginTop: 6,
  },
  assignedNotice: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand500,
    borderRadius: 6,
    borderWidth: 0.5,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  assignedNoticeText: {
    color: colors.brand700,
    fontSize: 12,
    fontWeight: "600",
  },
  rejectionNotice: {
    backgroundColor: colors.red50,
    borderColor: colors.red600,
    borderRadius: 6,
    borderWidth: 0.5,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  rejectionNoticeText: {
    color: colors.red700,
    fontSize: 12,
    fontWeight: "500",
  },
});
