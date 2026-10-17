import { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
  Modal,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, UrlTile } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useDriverTracking } from "../hooks/useDriverTracking";
import { getPickupTracking } from "../api/pickups";
import { updateDriverPickupStatus } from "../api/driver";
import { colors } from "../theme/colors";

const ARRIVAL_RADIUS_METERS = parseInt(
  process.env.EXPO_PUBLIC_ARRIVAL_RADIUS_METERS || "300",
  10
);

const DEFAULT_PICKUP_COORDS = Object.freeze({ lat: 19.0544, lng: 72.8402 });
const DEFAULT_TILE_URL = process.env.EXPO_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_TILE_URL = "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png";

export default function DriverJobScreen({ route, navigation }) {
  const { pickupId } = route.params || {};
  const [jobData, setJobData] = useState(null);
  const [status, setStatus] = useState("assigned");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  // UrlTile states (tileSize=256, maximumZ=18, fallback tile URL, loading & error state)
  const [tileUrl, setTileUrl] = useState(DEFAULT_TILE_URL);
  const [tileLoading, setTileLoading] = useState(true);
  const [tileError, setTileError] = useState(false);

  // Render counting (Requirement B.1)
  const renderCountRef = useRef(0);
  const renderStartTimeRef = useRef(Date.now());
  renderCountRef.current += 1;
  const elapsedSec = (Date.now() - renderStartTimeRef.current) / 1000;
  if (__DEV__ && elapsedSec >= 5) {
    const rps = (renderCountRef.current / elapsedSec).toFixed(1);
    console.log(`[DriverJobScreen] Render rate: ${rps} renders/sec (${renderCountRef.current} renders in ${elapsedSec.toFixed(0)}s)`);
    renderCountRef.current = 0;
    renderStartTimeRef.current = Date.now();
  }

  // Dev demo override for arrival distance check
  const isDemoMode =
    (typeof __DEV__ !== "undefined" && Boolean(__DEV__)) ||
    process.env.EXPO_PUBLIC_DEMO_MODE === "true";
  const [demoBypassDistance, setDemoBypassDistance] = useState(isDemoMode);

  // Completion modal state
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [wasteWeightKg, setWasteWeightKg] = useState("5.0");

  const mapRef = useRef(null);

  // 1. Fetch initial job & tracking snapshot
  const fetchJob = async () => {
    if (!pickupId) return;
    setLoading(true);
    setApiError(null);
    try {
      const res = await getPickupTracking(pickupId);
      if (res?.tracking) {
        setJobData(res.tracking);
        setStatus(res.tracking.status);
      }
    } catch (err) {
      setApiError(err.message || "Failed to load pickup job");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [pickupId]);

  // Stable pickup coordinates reference to avoid re-triggering useDriverTracking watcher on every render
  const pickupCoords = useMemo(() => {
    return jobData?.pickupCoordinates || DEFAULT_PICKUP_COORDS;
  }, [jobData?.pickupCoordinates]);

  // 2. Foreground GPS tracking hook
  const {
    currentCoords,
    isSharing,
    distanceToPickup,
    permissionGranted,
    permissionError,
    socketConnected,
    requestLocationPermission,
  } = useDriverTracking(status, pickupCoords);

  // Handle Quick Call
  const handleCallCustomer = () => {
    const phone = jobData?.driver?.phone || jobData?.user?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert("No Phone Number", "Customer phone number is not available.");
    }
  };

  // Status Transition Action: "Start Trip"
  const handleStartTrip = async () => {
    setSubmitting(true);
    setApiError(null);
    try {
      await updateDriverPickupStatus(pickupId, { status: "on_the_way" });
      setStatus("on_the_way");
    } catch (err) {
      setApiError(err.message || "Could not start trip");
    } finally {
      setSubmitting(false);
    }
  };

  // Status Transition Action: "I've Arrived"
  const handleArrived = async () => {
    // Distance verification check
    const shouldBypass = isDemoMode && demoBypassDistance;
    if (!shouldBypass && distanceToPickup !== null && distanceToPickup > ARRIVAL_RADIUS_METERS) {
      Alert.alert(
        "Too Far From Pickup",
        `You are currently ~${distanceToPickup} meters away from the pickup location. You must be within ${ARRIVAL_RADIUS_METERS} meters to confirm arrival.${
          isDemoMode ? "\n\n(Tip: Toggle 'Demo Override' below if testing in simulator)." : ""
        }`,
        [{ text: "OK" }]
      );
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      await updateDriverPickupStatus(pickupId, {
        status: "arrived",
      });
      setStatus("arrived");
    } catch (err) {
      setApiError(err.message || "Could not update status to arrived");
    } finally {
      setSubmitting(false);
    }
  };

  // Status Transition Action: "Complete Pickup"
  const handleConfirmComplete = async () => {
    const weightNum = parseFloat(wasteWeightKg);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert("Invalid Weight", "Please enter a valid weight in kilograms.");
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      const res = await updateDriverPickupStatus(pickupId, {
        status: "completed",
        wasteQuantity: weightNum,
      });
      setCompleteModalVisible(false);
      setStatus("completed");
      Alert.alert(
        "Pickup Completed",
        `Successfully collected ${weightNum} kg. ${res.pointsEarned ? `+${res.pointsEarned} Green Points awarded to customer.` : ""}`,
        [{ text: "Back to Jobs", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      setApiError(err.message || "Failed to complete pickup");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !jobData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.brand600} />
        <Text style={styles.loadingText}>Loading pickup details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.neutral800} />
          <Text style={styles.backText}>All Jobs</Text>
        </TouchableOpacity>
        <View style={styles.jobIdPill}>
          <Text style={styles.jobIdText}>ID: {pickupId?.slice(0, 8)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Error Banner */}
        {apiError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.red600} style={{ marginRight: 8 }} />
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        )}

        {/* Live GPS Sharing Indicator */}
        {isSharing && (
          <View style={styles.sharingBanner}>
            <View style={styles.pulseDot} />
            <Text style={styles.sharingText}>
              Sharing live location {socketConnected ? "• Connected" : "• Reconnecting..."}
            </Text>
          </View>
        )}

        {/* Informative Notice Banner */}
        <View style={styles.infoNotice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.neutral700} style={{ marginRight: 6 }} />
          <Text style={styles.infoNoticeText}>
            Keep this screen open while en route. Foreground GPS is active. Background location tracking is disabled.
          </Text>
        </View>

        {/* Mini Destination Map */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: pickupCoords.lat,
              longitude: pickupCoords.lng,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            mapType="none"
            onMapReady={() => setTileLoading(false)}
            onError={(e) => {
              console.warn("[DriverJobScreen] MapView/Tile error:", e?.nativeEvent || e);
              if (tileUrl !== FALLBACK_TILE_URL) {
                setTileUrl(FALLBACK_TILE_URL);
                setTileError(true);
              }
            }}
            showsUserLocation={true}
            showsCompass={false}
          >
            <UrlTile
              urlTemplate={tileUrl}
              tileSize={256}
              maximumZ={18}
              flipY={false}
              zIndex={-1}
            />
            <Marker
              coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
              title="Customer Pickup Spot"
              description={jobData?.address}
              tracksViewChanges={false}
            >
              <View style={styles.pinWrapper}>
                <View style={styles.pinCircle}>
                  <View style={styles.pinDot} />
                </View>
                <View style={styles.pinTip} />
              </View>
            </Marker>
          </MapView>
          {tileLoading && (
            <View style={styles.tileLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.brand700} />
            </View>
          )}
          {tileError && (
            <View style={styles.tileErrorBanner} pointerEvents="none">
              <Text style={styles.tileErrorText}>Using backup map tiles</Text>
            </View>
          )}
          <View style={styles.attributionPill} pointerEvents="none">
            <Text style={styles.attributionPillText}>© OpenStreetMap</Text>
          </View>
          <View style={styles.mapOverlayPill}>
            <Text style={styles.mapOverlayText}>
              {distanceToPickup !== null ? `Distance: ~${distanceToPickup}m away` : "Calculating GPS distance..."}
            </Text>
          </View>
        </View>

        {/* Customer & Address Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.customerName}>{jobData?.user?.name || "Citizen Customer"}</Text>
              <Text style={styles.customerSub}>WasteWise Citizen Account</Text>
            </View>
            <TouchableOpacity onPress={handleCallCustomer} style={styles.callBtn}>
              <Ionicons name="call" size={14} color={colors.white} style={{ marginRight: 4 }} />
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValueAddress}>{jobData?.address || "Mumbai Demo Address"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Waste Type</Text>
            <Text style={styles.detailValue}>{jobData?.wasteType || "Mixed Recyclables"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quantity Band</Text>
            <Text style={styles.detailValue}>{jobData?.quantityBand || "Medium"}</Text>
          </View>
        </View>

        {/* Demo Override Toggle (Only in DEV or EXPO_PUBLIC_DEMO_MODE) */}
        {isDemoMode && (
          <View style={styles.overrideCard}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.overrideTitle}>Demo Override: Ignore Distance</Text>
              <Text style={styles.overrideSub}>
                Allows confirming "I've Arrived" without being within {ARRIVAL_RADIUS_METERS}m (for demo & simulator use).
              </Text>
            </View>
            <Switch
              value={demoBypassDistance}
              onValueChange={setDemoBypassDistance}
              trackColor={{ false: colors.neutral300, true: colors.brand600 }}
            />
          </View>
        )}

        {/* ========================================================
            BIG HIGH-CONTRAST ACTION BUTTONS
        ======================================================== */}
        <View style={styles.actionContainer}>
          {status === "assigned" && (
            <TouchableOpacity
              style={[styles.bigButton, styles.btnStart, submitting && styles.btnDisabled]}
              onPress={handleStartTrip}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={22} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.bigButtonText}>START TRIP</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {status === "on_the_way" && (
            <TouchableOpacity
              style={[styles.bigButton, styles.btnArrived, submitting && styles.btnDisabled]}
              onPress={handleArrived}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="location" size={22} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.bigButtonText}>I'VE ARRIVED</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {status === "arrived" && (
            <TouchableOpacity
              style={[styles.bigButton, styles.btnComplete, submitting && styles.btnDisabled]}
              onPress={() => setCompleteModalVisible(true)}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={22} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.bigButtonText}>COMPLETE PICKUP</Text>
            </TouchableOpacity>
          )}

          {status === "completed" && (
            <View style={styles.completedNotice}>
              <Ionicons name="checkmark-circle" size={24} color={colors.brand600} style={{ marginRight: 8 }} />
              <Text style={styles.completedNoticeText}>This pickup was completed successfully.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Completion Modal for weighing input */}
      <Modal visible={completeModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Waste Collection</Text>
            <Text style={styles.modalSub}>
              Enter the weighed recyclable quantity collected from this customer to calculate Green Points:
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.weightInput}
                value={wasteWeightKg}
                onChangeText={setWasteWeightKg}
                keyboardType="decimal-pad"
                placeholder="5.0"
              />
              <Text style={styles.unitText}>kg</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCompleteModalVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmComplete}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm & Finish</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.neutral600,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral200,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral800,
    marginLeft: 6,
  },
  jobIdPill: {
    backgroundColor: colors.neutral100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  jobIdText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.neutral600,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.red50,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.red600,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.red700,
    fontWeight: "500",
  },
  sharingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand50,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.brand200,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand600,
    marginRight: 8,
  },
  sharingText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand700,
  },
  infoNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral100,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  infoNoticeText: {
    fontSize: 11,
    color: colors.neutral700,
    flex: 1,
    lineHeight: 15,
  },
  mapContainer: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  pinWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 38,
  },
  pinCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.red600,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.red600,
    marginTop: -2,
  },
  attributionPill: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attributionPillText: {
    fontSize: 9,
    color: colors.neutral700,
  },
  mapOverlayPill: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapOverlayText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "600",
  },
  detailsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral900,
  },
  customerSub: {
    fontSize: 12,
    color: colors.neutral500,
    marginTop: 2,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand600,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  callBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral200,
    marginVertical: 12,
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
    marginLeft: 16,
  },
  overrideCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.amber50,
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.amber300,
  },
  overrideTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.amber900,
  },
  overrideSub: {
    fontSize: 11,
    color: colors.amber800,
    marginTop: 2,
    lineHeight: 14,
  },
  actionContainer: {
    marginTop: 6,
  },
  bigButton: {
    height: 60,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  btnStart: {
    backgroundColor: colors.blue600,
  },
  btnArrived: {
    backgroundColor: colors.amber600,
  },
  btnComplete: {
    backgroundColor: colors.brand600,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  bigButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },
  completedNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: colors.brand50,
    borderRadius: 14,
  },
  completedNoticeText: {
    color: colors.brand700,
    fontSize: 14,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.neutral900,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: colors.neutral600,
    lineHeight: 18,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  weightInput: {
    width: 100,
    height: 54,
    borderWidth: 2,
    borderColor: colors.brand600,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    color: colors.neutral900,
    marginRight: 10,
  },
  unitText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.neutral700,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral100,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral700,
  },
  modalConfirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand600,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  tileLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(240, 244, 248, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  tileErrorBanner: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.amber100,
    borderColor: colors.amber600,
    borderWidth: 0.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 2,
  },
  tileErrorText: {
    fontSize: 10,
    color: colors.amber800,
    fontWeight: "600",
  },
});
