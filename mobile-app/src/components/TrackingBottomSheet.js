import React, { useState, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Linking, Animated, PanResponder, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import StatusStepper from "./StatusStepper";

const SNAP_POINTS = {
  collapsed: 160,
  half: 380,
  full: 580,
};

function TrackingBottomSheet({
  trackingData,
  status,
  navigation,
  connectionState,
  isStale,
  onCancelPickup,
}) {
  const [currentSnap, setCurrentSnap] = useState("collapsed");
  const animatedHeight = useRef(new Animated.Value(SNAP_POINTS.collapsed)).current;

  const snapTo = (snapName) => {
    setCurrentSnap(snapName);
    Animated.spring(animatedHeight, {
      toValue: SNAP_POINTS[snapName],
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  };

  // Drag Gesture Handler
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          // Dragged up
          if (currentSnap === "collapsed") snapTo("half");
          else if (currentSnap === "half") snapTo("full");
        } else if (gestureState.dy > 50) {
          // Dragged down
          if (currentSnap === "full") snapTo("half");
          else if (currentSnap === "half") snapTo("collapsed");
        }
      },
    })
  ).current;

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
    <Animated.View style={[styles.sheetContainer, { height: animatedHeight }]}>
      {/* Drag Bar & Handle */}
      <View {...panResponder.panHandlers} style={styles.handleContainer}>
        <View style={styles.handleBar} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={currentSnap === "full"}
      >
        {/* ========================================================
            SECTION 1: COLLAPSED HEADER (Always visible)
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
                <Text style={styles.etaBig}>
                  Arriving in ~{etaMinutes} min
                </Text>
                <Text style={styles.subtext}>
                  {distanceKm} km away • {vehicle?.type || "Eco Collection Vehicle"}
                </Text>
              </View>
            )}
          </View>

          {/* Connection Chip */}
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
                {connectionState === "connected" ? "Live" : "Reconnecting..."}
              </Text>
            </View>

            {isStale && status !== "completed" && status !== "arrived" ? (
              <View style={styles.staleChip}>
                <Text style={styles.staleText}>GPS Signal Weak</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Snap point quick toggle buttons */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            onPress={() => snapTo(currentSnap === "collapsed" ? "half" : "collapsed")}
            style={styles.toggleButton}
          >
            <Ionicons
              name={currentSnap === "collapsed" ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.brand700}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.toggleText}>
              {currentSnap === "collapsed" ? "View Driver & Details" : "Collapse Sheet"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ========================================================
            SECTION 2: HALF VIEW - DRIVER CARD & STATUS STEPPER
        ======================================================== */}
        {isAssigned && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={22} color={colors.brand700} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driver?.name || "Assigned Driver"}</Text>
              <Text style={styles.driverVehicle}>
                {vehicle?.registrationNo} • {vehicle?.type}
              </Text>
            </View>
            {driver?.phone && ["assigned", "on_the_way", "arrived"].includes(status) ? (
              <TouchableOpacity onPress={handleCallDriver} style={styles.callButton}>
                <Ionicons name="call" size={13} color={colors.white} style={{ marginRight: 4 }} />
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={styles.sectionDivider} />

        {/* Status Stepper */}
        <Text style={styles.sectionHeader}>Trip Progress</Text>
        <StatusStepper
          status={status}
          timestamps={{
            assignedAt: trackingData?.assignedAt,
            startedAt: trackingData?.startedAt,
            arrivedAt: trackingData?.arrivedAt,
            completedAt: trackingData?.completedAt,
          }}
        />

        {/* ========================================================
            SECTION 3: FULL VIEW - PICKUP DETAILS & CANCEL BUTTON
        ======================================================== */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionHeader}>Pickup Summary</Text>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Waste Category:</Text>
            <Text style={styles.detailValue}>{trackingData?.wasteType || "Mixed Recyclables"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quantity Band:</Text>
            <Text style={styles.detailValue}>{trackingData?.quantityBand || "Medium"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pickup Address:</Text>
            <Text style={styles.detailValueAddress}>{trackingData?.address || "Address"}</Text>
          </View>
        </View>

        {/* Cancel button if pickup is still cancellable (requested or assigned) */}
        {["requested", "assigned"].includes(status) && onCancelPickup ? (
          <TouchableOpacity onPress={onCancelPickup} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel Pickup Request</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </Animated.View>
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
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 100,
  },
  handleContainer: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.neutral300,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  etaCol: {
    flex: 1,
    paddingRight: 10,
  },
  etaBig: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.neutral900,
    letterSpacing: -0.5,
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.brand700,
  },
  completedSub: {
    fontSize: 13,
    color: colors.brand600,
    marginTop: 2,
  },
  arrivedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.blue600,
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
    marginVertical: 10,
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
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral200,
    marginTop: 6,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 22,
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
    marginVertical: 16,
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
