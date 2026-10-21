import React, { useRef, useMemo, useCallback, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import StatusStepper from "./StatusStepper";

function TrackingBottomSheet({
  trackingData,
  status,
  navigation,
  connectionState,
  isStale,
  onCancelPickup,
}) {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [sheetIndex, setSheetIndex] = useState(1); // 0: collapsed, 1: half, 2: full

  // Three snap points: Collapsed (~160px), Half (~420px), Full (~88% of screen)
  const snapPoints = useMemo(() => ["22%", "52%", "88%"], []);

  const handleSheetChange = useCallback((index) => {
    setSheetIndex(index);
  }, []);

  const toggleSheetSnap = useCallback(() => {
    if (sheetIndex <= 0) {
      sheetRef.current?.snapToIndex(1);
    } else if (sheetIndex === 1) {
      sheetRef.current?.snapToIndex(2);
    } else {
      sheetRef.current?.snapToIndex(0);
    }
  }, [sheetIndex]);

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
    <BottomSheet
      ref={sheetRef}
      index={1} // Default open to half snap
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      enablePanDownToClose={false}
      enableOverDrag={false}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 40, 60) },
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
                connectionState === "connected" && styles.connChipConnected,
                connectionState === "reconnecting" && styles.connChipReconnecting,
              ]}
            >
              <View
                style={[
                  styles.connDot,
                  connectionState === "connected" && styles.connDotConnected,
                ]}
              />
              <Text style={styles.connText}>
                {connectionState === "connected"
                  ? "Live"
                  : connectionState === "reconnecting"
                  ? "Reconnecting"
                  : "Offline"}
              </Text>
            </View>

            {isStale && status === "on_the_way" && (
              <View style={styles.staleChip}>
                <Text style={styles.staleText}>GPS Signal Weak</Text>
              </View>
            )}
          </View>
        </View>

        {/* Snap Toggle Helper Pill */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={toggleSheetSnap}
            activeOpacity={0.7}
          >
            <Ionicons
              name={sheetIndex === 2 ? "chevron-down" : "chevron-up"}
              size={14}
              color={colors.brand700}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.toggleText}>
              {sheetIndex === 2
                ? "Collapse Sheet"
                : sheetIndex === 1
                ? "Expand Details"
                : "View Trip Progress"}
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
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 12,
  },
  handleIndicator: {
    backgroundColor: colors.neutral300,
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
  etaBig: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.neutral900,
    letterSpacing: -0.3,
  },
  arrivedTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand700,
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
  subtext: {
    fontSize: 13,
    color: colors.neutral500,
    marginTop: 3,
  },
  chipsCol: {
    alignItems: "flex-end",
  },
  connChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connChipConnected: {
    backgroundColor: colors.brand50,
  },
  connChipReconnecting: {
    backgroundColor: colors.amber50,
  },
  connDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral400,
    marginRight: 5,
  },
  connDotConnected: {
    backgroundColor: colors.brand600,
  },
  connText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral700,
  },
  staleChip: {
    marginTop: 4,
    backgroundColor: colors.amber50,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staleText: {
    fontSize: 10,
    color: colors.amber700,
    fontWeight: "600",
  },
  toggleRow: {
    alignItems: "center",
    marginVertical: 8,
  },
  toggleButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.brand50,
    flexDirection: "row",
    alignItems: "center",
  },
  toggleText: {
    fontSize: 12,
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
    marginTop: 4,
  },
  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral900,
  },
  driverVehicle: {
    fontSize: 12,
    color: colors.neutral500,
    marginTop: 2,
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
});

export default React.memo(TrackingBottomSheet);
