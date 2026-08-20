import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import StatusBadge from "../components/StatusBadge";
import ErrorState from "../components/ErrorState";
import { useMeta } from "../hooks/useMeta";
import { getPickup } from "../api/pickups";
import { colors } from "../theme/colors";

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function PickupDetailScreen({ route }) {
  const { id } = route.params;
  const { wasteTypeLabel, quantityBandLabel, slotPeriodLabel } = useMeta();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pickup", id],
    queryFn: () => getPickup(id),
  });

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <ActivityIndicator color={colors.brand600} />
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

  const pickup = data.pickup;

  return (
    <Screen>
      <Card>
        <View style={styles.header}>
          <Text style={styles.type}>{wasteTypeLabel(pickup.wasteType)}</Text>
          <StatusBadge status={pickup.status} />
        </View>

        <Row label="Quantity" value={quantityBandLabel(pickup.quantityBand)} />
        <Row
          label="Slot"
          value={`${slotPeriodLabel(pickup.slotPeriod)} · ${new Date(
            pickup.requestedDate
          ).toLocaleDateString()}`}
        />
        <Row label="Address" value={pickup.address} />
        <Row label="Assigned to" value={pickup.assignedAdmin?.name || "Not yet assigned"} />
        {pickup.pointsLedgerEntry && (
          <Row label="Points earned" value={`${pickup.pointsLedgerEntry.pointsEarned}`} />
        )}

        {pickup.photoUrl && (
          <Image source={{ uri: pickup.photoUrl }} style={styles.photo} resizeMode="cover" />
        )}
      </Card>
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
  type: {
    color: colors.neutral900,
    fontSize: 18,
    fontWeight: "700",
  },
  row: {
    borderTopColor: colors.neutral100,
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  rowLabel: {
    color: colors.neutral500,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  rowValue: {
    color: colors.neutral900,
    fontSize: 14,
    marginTop: 4,
  },
  photo: {
    borderRadius: 12,
    height: 180,
    marginTop: 16,
    width: "100%",
  },
});
