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
        <View style={styles.topBar}>
          <Text style={styles.pickupId}>Pickup #{pickup.id.slice(0, 8).toUpperCase()}</Text>
          <StatusBadge status={pickup.status} />
        </View>

        <View style={styles.header}>
          <Text style={styles.type}>{wasteTypeLabel(pickup.wasteType)}</Text>
        </View>

        {pickup.status === "rejected" && (
          <View style={styles.rejectionCard}>
            <Text style={styles.rejectionTitle}>⚠️ Rejection Reason</Text>
            <Text style={styles.rejectionBody}>
              {pickup.rejectionReason || "No specific reason provided."}
            </Text>
          </View>
        )}

        <Row
          label="Quantity"
          value={`${quantityBandLabel(pickup.quantityBand)}${
            pickup.wasteQuantity ? ` (~${pickup.wasteQuantity} kg)` : ""
          }`}
        />
        <Row
          label="Slot"
          value={`${slotPeriodLabel(pickup.slotPeriod)} · ${new Date(
            pickup.requestedDate
          ).toLocaleDateString()}`}
        />
        <Row label="Address" value={pickup.address} />
        <Row
          label="Assigned Collector"
          value={
            pickup.assignedAdmin
              ? `${pickup.assignedAdmin.name}${pickup.assignedAdmin.phone ? ` (${pickup.assignedAdmin.phone})` : ""}`
              : "Not yet assigned"
          }
        />
        {pickup.pointsLedgerEntry && (
          <Row label="Points earned" value={`+${pickup.pointsLedgerEntry.pointsEarned} Green Points`} />
        )}

        {pickup.photoUrl && (
          <Image source={{ uri: pickup.photoUrl }} style={styles.photo} resizeMode="cover" />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pickupId: {
    color: colors.neutral500,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  rejectionCard: {
    backgroundColor: colors.red50,
    borderColor: colors.red600,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  rejectionTitle: {
    color: colors.red700,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  rejectionBody: {
    color: colors.red600,
    fontSize: 14,
    lineHeight: 18,
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
