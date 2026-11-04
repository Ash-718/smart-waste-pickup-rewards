import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import StatusStepper from "./StatusStepper";

function formatTelemetryAge(sec) {
  if (sec === null || sec === undefined) return "";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
}

function TrackingBottomSheetWeb({
  trackingData,
  vehicleLocation,
  status,
  navigation,
  connectionState,
  isStale,
  telemetryAgeSec,
  demoMode = false,
  onCancelPickup,
  isSimulating = false,
  simLoading = false,
  onToggleSimulation = null,
}) {
  const insets = useSafeAreaInsets();
  // isExpanded: false = collapsed (~180px), true = expanded (~55% of screen)
  const [isExpanded, setIsExpanded] = useState(true);

  const secondsAgo =
    telemetryAgeSec !== undefined && telemetryAgeSec !== null
      ? telemetryAgeSec
      : vehicleLocation?.recordedAt
      ? Math.max(0, Math.round((Date.now() - new Date(vehicleLocation.recordedAt).getTime()) / 1000))
      : null;

  const driver = trackingData?.driver;
  const vehicle = trackingData?.vehicle;
  const isAssigned = Boolean(vehicle);
  const etaMinutes = navigation?.durationMinutes || 6;
  const distanceKm = navigation?.distanceKm || 1.8;

  const handleCallDriver = () => {
    if (driver?.phone) {
      Linking.openURL(`tel:${driver.phone}`);
    }
  };

  return (
    <View style={[styles.sheetContainer, isExpanded ? styles.sheetExpanded : styles.sheetCollapsed]}>
      {/* Top Handle / Drag Bar */}
      <TouchableOpacity
        style={styles.handleContainer}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.handleIndicator} />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
      >
        {/* ========================================================
            SECTION 1: STATUS & ETA HEADER
        ======================================================== */}
        <View style={styles.headerRow}>
          <View style={styles.etaCol}>
            {status === "completed" ? (
              <View>
                <Text style={styles.completedTitle}>Pickup Completed!</Text>
                <Text style={styles.completedSub}>Thank you for recycling responsibly</Text>
              </View>
            ) : status === "arrived" ? (
              <View>
                <Text style={styles.arrivedTitle}>Driver Has Arrived</Text>
                <Text style={styles.subtext}>Please hand over your recyclables</Text>
              </View>
            ) : !isAssigned ? (
              <View>
                <Text style={styles.etaBig}>Assigning Vehicle...</Text>
                <Text style={styles.subtext}>Finding nearest waste collector</Text>
              </View>
            ) : isStale ? (
              <View>
                <Text style={[styles.etaBig, { color: colors.amber700 }]}>Last Known Location</Text>
                <Text style={styles.subtext}>
                  Live ETA paused • GPS inactive ({formatTelemetryAge(secondsAgo)})
                </Text>
                <Text style={styles.staleEstimateSub}>
                  Last estimate: ~{etaMinutes} min ({distanceKm} km away) • Paused
                </Text>
              </View>
            ) : !trackingData?.pickupCoordinates || !navigation ? (
              <View>
                <Text style={styles.etaBig}>Vehicle En Route</Text>
                <Text style={styles.subtext}>
                  Live location active • {vehicle?.type || "Eco Collection Vehicle"}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.etaBig}>Arriving in ~{etaMinutes} min</Text>
                <Text style={styles.subtext}>
                  {distanceKm} km away • {vehicle?.type || "Eco Collection Vehicle"}
                </Text>
              </View>
            )}
          </View>

          {/* Connection Chip & Telemetry Health */}
          <View style={styles.chipsCol}>
            <View
              style={[
                styles.connChip,
                connectionState === "connected" && !isStale && styles.connChipConnected,
                connectionState === "connected" && isStale && styles.connChipStale,
                connectionState === "reconnecting" && styles.connChipReconnecting,
              ]}
            >
              <View
                style={[
                  styles.connDot,
                  connectionState === "connected" && !isStale && styles.connDotConnected,
                  connectionState === "connected" && isStale && styles.connDotStale,
                ]}
              />
              <Text
                style={[
                  styles.connText,
                  connectionState === "connected" && isStale && styles.connTextStale,
                ]}
              >
                {connectionState === "connected"
                  ? isStale
                    ? "GPS Stale"
                    : "Live"
                  : connectionState === "reconnecting"
                  ? "Reconnecting"
                  : "Offline"}
              </Text>
            </View>

            {isStale && status !== "completed" && status !== "arrived" ? (
              <View style={styles.staleChip}>
                <Text style={styles.staleText}>
                  GPS Inactive {secondsAgo !== null ? `(${formatTelemetryAge(secondsAgo)})` : ""}
                </Text>
              </View>
            ) : !isStale && secondsAgo !== null ? (
              <View style={styles.demoUpdateChip}>
                <Text style={styles.demoUpdateText}>updated {formatTelemetryAge(secondsAgo)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Virtual Driver Simulation Action Card */}
        {onToggleSimulation && ["assigned", "on_the_way"].includes(status) && (
          <TouchableOpacity
            style={[styles.simCard, isSimulating && styles.simCardActive]}
            onPress={onToggleSimulation}
            disabled={simLoading}
            activeOpacity={0.8}
          >
            <View style={[styles.simIconWrap, isSimulating && styles.simIconWrapActive]}>
              <Ionicons
                name={isSimulating ? "pause" : "play"}
                size={16}
                color={isSimulating ? colors.white : colors.brand700}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.simTitle, isSimulating && styles.simTitleActive]}>
                {isSimulating ? "Virtual GPS Active (Driver Moving)" : "Start Virtual GPS Simulation"}
              </Text>
              <Text style={[styles.simDesc, isSimulating && styles.simDescActive]}>
                {isSimulating
                  ? "Emitting 30 km/h coordinates live • Updating ETA"
                  : "Simulate a live driver moving along roads to your location"}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Expand / Collapse Toggle Helper Pill */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isExpanded ? "chevron-down" : "chevron-up"}
              size={14}
              color={colors.brand700}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.toggleText}>
              {isExpanded ? "Collapse Sheet" : "Expand Trip Details"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================
            SECTION 2: DRIVER CARD
        ======================================================== */}
        {driver && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={20} color={colors.brand700} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver.name || "Assigned Driver"}</Text>
              <Text style={styles.driverVehicle}>
                {vehicle?.registrationNo || "Vehicle"} • {vehicle?.type || "Waste Collector"}
              </Text>
            </View>
            {driver?.phone ? (
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleCallDriver}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={14} color={colors.white} style={{ marginRight: 5 }} />
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={styles.sectionDivider} />

        {/* ========================================================
            SECTION 3: TRIP PROGRESS STEPPER
        ======================================================== */}
        <Text style={styles.sectionHeader}>Trip Progress</Text>
        <StatusStepper
          status={status}
          timestamps={trackingData?.timestamps || {}}
        />

        <View style={styles.sectionDivider} />

        {/* ========================================================
            SECTION 4: PICKUP DETAILS CARD
        ======================================================== */}
        <Text style={styles.sectionHeader}>Pickup Details</Text>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValueAddress} numberOfLines={2}>
              {trackingData?.address || "Location specified"}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Waste Type</Text>
            <Text style={styles.detailValue}>{trackingData?.wasteType || "Recyclables"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quantity</Text>
            <Text style={styles.detailValue}>{trackingData?.quantityBand || "Medium"}</Text>
          </View>
          {trackingData?.wasteQuantity ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Scale Measured Weight</Text>
              <Text style={[styles.detailValue, { color: colors.brand700, fontWeight: "700" }]}>
                {trackingData.wasteQuantity} kg
              </Text>
            </View>
          ) : null}
        </View>

        {/* ========================================================
            SECTION 5: CANCEL PICKUP ACTION
        ======================================================== */}
        {onCancelPickup && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancelPickup}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>Cancel Pickup Request</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 20,
    transition: "height 0.3s ease",
  },
  sheetCollapsed: {
    height: 190,
  },
  sheetExpanded: {
    height: "55%",
    maxHeight: 520,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 10,
    cursor: "pointer",
  },
  handleIndicator: {
    backgroundColor: colors.neutral300,
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  etaCol: {
    flex: 1,
    paddingRight: 12,
  },
  completedTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand700,
  },
  completedSub: {
    fontSize: 13,
    color: colors.neutral500,
    marginTop: 2,
  },
  arrivedTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand600,
  },
  etaBig: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.neutral900,
  },
  subtext: {
    fontSize: 13,
    color: colors.neutral500,
    marginTop: 2,
  },
  staleEstimateSub: {
    fontSize: 12,
    color: colors.amber700,
    fontWeight: "600",
    marginTop: 3,
  },
  chipsCol: {
    alignItems: "flex-end",
  },
  connChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.neutral100,
  },
  connChipConnected: {
    backgroundColor: "#DCFCE7",
  },
  connChipStale: {
    backgroundColor: "#FEF3C7",
  },
  connChipReconnecting: {
    backgroundColor: "#FEE2E2",
  },
  connDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral400,
    marginRight: 5,
  },
  connDotConnected: {
    backgroundColor: "#16A34A",
  },
  connDotStale: {
    backgroundColor: "#D97706",
  },
  connText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.neutral600,
  },
  connTextStale: {
    color: "#B45309",
  },
  staleChip: {
    marginTop: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  staleText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#B45309",
  },
  demoUpdateChip: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  demoUpdateText: {
    fontSize: 10,
    color: colors.neutral400,
  },
  toggleRow: {
    alignItems: "center",
    marginVertical: 6,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.neutral100,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand700,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral50,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral200,
    marginVertical: 4,
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  driverInfo: {
    flex: 1,
    marginLeft: 10,
  },
  driverName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral900,
  },
  driverVehicle: {
    fontSize: 12,
    color: colors.neutral500,
    marginTop: 1,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand600,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  callButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.neutral200,
    marginVertical: 14,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral900,
    marginBottom: 8,
  },
  detailsCard: {
    backgroundColor: colors.neutral50,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.neutral500,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral900,
  },
  detailValueAddress: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral900,
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red600,
  },
  cancelText: {
    color: colors.red600,
    fontWeight: "700",
    fontSize: 14,
  },
  simCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: colors.brand500,
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
  },
  simCardActive: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand700,
  },
  simIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  simIconWrapActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  simTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065F46",
  },
  simTitleActive: {
    color: colors.white,
  },
  simDesc: {
    fontSize: 11,
    color: "#047857",
    marginTop: 2,
  },
  simDescActive: {
    color: "rgba(255,255,255,0.9)",
  },
});

export default React.memo(TrackingBottomSheetWeb);
