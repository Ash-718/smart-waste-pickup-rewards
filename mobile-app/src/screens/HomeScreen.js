import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../hooks/useMeta";
import { getBalance } from "../api/points";
import { listPickups } from "../api/pickups";
import { colors } from "../theme/colors";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { wasteTypeLabel } = useMeta();

  const balanceQuery = useQuery({ queryKey: ["points-balance"], queryFn: getBalance });
  const pickupsQuery = useQuery({ queryKey: ["pickups", "all"], queryFn: () => listPickups() });

  const recentPickups = (pickupsQuery.data?.pickups || []).slice(0, 3);
  const reminder = balanceQuery.data?.reminder;

  return (
    <Screen
      onRefresh={() => {
        balanceQuery.refetch();
        pickupsQuery.refetch();
      }}
      refreshing={balanceQuery.isFetching || pickupsQuery.isFetching}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.subtitle}>Pruthvi ZeroWaste Foundation</Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      {reminder?.due && (
        <Card style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>Time for another pickup?</Text>
          <Text style={styles.reminderBody}>
            It's been {reminder.daysSinceLastPickup} days since your last completed pickup.
          </Text>
        </Card>
      )}

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Green Points balance</Text>
        <Text style={styles.balanceValue}>
          {balanceQuery.data ? balanceQuery.data.balance : "—"}
        </Text>
      </Card>

      <View style={styles.cta}>
        <Button title="Book a Pickup" onPress={() => navigation.navigate("BookPickup")} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent pickups</Text>
        <Pressable onPress={() => navigation.navigate("Pickups")}>
          <Text style={styles.link}>View all</Text>
        </Pressable>
      </View>

      {recentPickups.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No pickups yet. Book your first one above.</Text>
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
              <Text style={styles.pickupDate}>
                {new Date(pickup.requestedDate).toLocaleDateString()}
              </Text>
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
    marginBottom: 20,
  },
  greeting: {
    color: colors.neutral900,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 2,
  },
  logout: {
    color: colors.neutral500,
    fontSize: 13,
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
  balanceCard: {
    marginBottom: 16,
  },
  balanceLabel: {
    color: colors.neutral500,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  balanceValue: {
    color: colors.brand700,
    fontSize: 36,
    fontWeight: "700",
    marginTop: 4,
  },
  cta: {
    marginBottom: 24,
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
  pickupDate: {
    color: colors.neutral500,
    fontSize: 12,
    marginTop: 6,
  },
});
