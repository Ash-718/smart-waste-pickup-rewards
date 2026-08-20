import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { useMeta } from "../hooks/useMeta";
import { listPickups } from "../api/pickups";
import { colors } from "../theme/colors";

const STATUS_FILTERS = ["all", "requested", "assigned", "completed", "cancelled"];

export default function MyPickupsScreen({ navigation }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const { wasteTypeLabel, slotPeriodLabel } = useMeta();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["pickups", statusFilter],
    queryFn: () => listPickups(statusFilter),
  });

  const pickups = data?.pickups || [];

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <View style={styles.header}>
        <Text style={styles.title}>My Pickups</Text>
        <Button title="Book new" onPress={() => navigation.navigate("BookPickup")} />
      </View>

      <View style={styles.filters}>
        {STATUS_FILTERS.map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatusFilter(s)}
            style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>
              {s[0].toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && <Text style={styles.loadingText}>Loading pickups…</Text>}
      {isError && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading && !isError && pickups.length === 0 && (
        <EmptyState
          title="No pickups here"
          description="There are no pickup requests matching this filter yet."
        />
      )}

      {pickups.map((pickup) => (
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
              {slotPeriodLabel(pickup.slotPeriod)} · {new Date(pickup.requestedDate).toLocaleDateString()}
            </Text>
            <Text style={styles.pickupAddress} numberOfLines={1}>
              {pickup.address}
            </Text>
          </Card>
        </Pressable>
      ))}
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
  title: {
    color: colors.neutral900,
    fontSize: 20,
    fontWeight: "700",
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    backgroundColor: colors.white,
    borderColor: colors.neutral200,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand600,
  },
  filterText: {
    color: colors.neutral600,
    fontSize: 12,
    fontWeight: "600",
  },
  filterTextActive: {
    color: colors.white,
  },
  loadingText: {
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
  pickupMeta: {
    color: colors.neutral500,
    fontSize: 12,
    marginTop: 6,
  },
  pickupAddress: {
    color: colors.neutral400,
    fontSize: 12,
    marginTop: 2,
  },
});
