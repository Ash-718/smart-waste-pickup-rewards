import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLiveTracking } from "../hooks/useLiveTracking";
import LeafletMap from "../components/LeafletMap";
import TrackingBottomSheet from "../components/TrackingBottomSheet";
import { colors } from "../theme/colors";
import { apiFetch } from "../lib/apiClient";

export default function TrackPickupScreen({ route, navigation }) {
  const { pickupId } = route.params || {};
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Render counting (Gated strictly behind __DEV__)
  const renderCountRef = useRef(0);
  const renderStartTimeRef = useRef(Date.now());
  if (typeof __DEV__ !== "undefined" && Boolean(__DEV__)) {
    renderCountRef.current += 1;
    const elapsedSec = (Date.now() - renderStartTimeRef.current) / 1000;
    if (elapsedSec >= 5) {
      const rps = (renderCountRef.current / elapsedSec).toFixed(1);
      console.log(`[TrackPickupScreen] Render rate: ${rps} renders/sec (${renderCountRef.current} renders in ${elapsedSec.toFixed(0)}s)`);
      renderCountRef.current = 0;
      renderStartTimeRef.current = Date.now();
    }
  }

  const {
    trackingData,
    vehicleLocation,
    status,
    navigation: routeNav,
    loading,
    error,
    connectionState,
    isStale,
    refetch,
  } = useLiveTracking(pickupId);

  // Pickup destination coordinates (null if not pinned)
  const pickupCoords = trackingData?.pickupCoordinates || null;

  // Fit map camera to show both vehicle and destination
  const handleRecenter = useCallback(() => {
    mapRef.current?.recenter();
  }, []);

  // Format OSRM route geometry coordinates for LeafletMap
  const polylineCoords = useMemo(() => {
    const raw = routeNav?.geometry?.coordinates;
    if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((coord) => [coord[1], coord[0]]); // [lat, lng]
  }, [routeNav?.geometry?.coordinates]);

  // Handle Cancel Pickup
  const handleCancelPickup = useCallback(() => {
    Alert.alert(
      "Cancel Pickup",
      "Are you sure you want to cancel this pickup request?",
      [
        { text: "No, Keep", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/pickups/${pickupId}/status`, {
                method: "PATCH",
                body: { status: "cancelled" },
              });
              Alert.alert("Pickup Cancelled", "Your pickup has been cancelled.", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              Alert.alert("Cancellation Failed", err.message || "Could not cancel pickup");
            }
          },
        },
      ]
    );
  }, [pickupId, navigation]);

  if (loading && !trackingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand600} />
        <Text style={styles.loadingText}>Locating your pickup & vehicle...</Text>
      </View>
    );
  }

  if (error && !trackingData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.amber600} style={{ marginBottom: 12 }} />
        <Text style={styles.errorTitle}>Unable to Track Pickup</Text>
        <Text style={styles.errorSub}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusIcons = {
    requested: "time-outline",
    assigned: "cube-outline",
    on_the_way: "car-outline",
    arrived: "location-outline",
    completed: "checkmark-circle-outline",
  };

  const statusLabels = {
    requested: "Request Pending",
    assigned: "Vehicle Assigned",
    on_the_way: "On the Way",
    arrived: "Arrived at Location",
    completed: "Pickup Completed",
  };

  return (
    <View style={styles.container}>
      {/* 1. Full Screen Interactive Leaflet Map via WebView */}
      <LeafletMap
        ref={mapRef}
        style={styles.map}
        pickup={pickupCoords}
        vehicle={vehicleLocation}
        route={polylineCoords}
        onReady={() => setMapReady(true)}
      />

      {/* 2. Floating Header: Back & Recenter */}
      <SafeAreaView style={styles.floatingHeader} edges={["top", "left", "right"]}>
        <TouchableOpacity style={styles.circleButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.neutral800} />
        </TouchableOpacity>

        {/* Live Status Banner */}
        <View style={styles.statusBanner}>
          <Ionicons
            name={statusIcons[status] || "information-circle-outline"}
            size={15}
            color={colors.white}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.statusBannerText}>
            {statusLabels[status] || "In Progress"}
          </Text>
        </View>

        <TouchableOpacity style={styles.circleButton} onPress={handleRecenter}>
          <Ionicons name="locate" size={20} color={colors.brand700} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* 3. Celebration Completion Card */}
      {status === "completed" && (
        <View style={styles.celebrationCard}>
          <Ionicons name="ribbon" size={48} color={colors.brand600} style={{ marginBottom: 8 }} />
          <Text style={styles.celebrationTitle}>Great Job Recycling!</Text>
          <Text style={styles.celebrationPoints}>
            +{trackingData?.pointsEarned || 25} Green Points Earned
          </Text>
          <Text style={styles.celebrationDesc}>
            Your recyclables have been collected and verified by Pruthvi Zero Waste Foundation.
          </Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate("MainTabs")}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Interactive Bottom Sheet with Trip Timeline & Details */}
      <TrackingBottomSheet
        trackingData={trackingData}
        status={status}
        navigation={routeNav}
        connectionState={connectionState}
        isStale={isStale}
        onCancelPickup={status === "requested" || status === "assigned" ? handleCancelPickup : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingHeader: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBannerText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.neutral600,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.neutral900,
    marginBottom: 6,
  },
  errorSub: {
    fontSize: 13,
    color: colors.neutral500,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: colors.brand600,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    color: colors.neutral600,
    fontSize: 14,
    fontWeight: "600",
  },
  celebrationCard: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 50,
  },
  celebrationTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.neutral900,
  },
  celebrationPoints: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.brand600,
    marginTop: 4,
  },
  celebrationDesc: {
    fontSize: 13,
    color: colors.neutral500,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  doneButton: {
    marginTop: 14,
    backgroundColor: colors.brand600,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 12,
  },
  doneButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
});
