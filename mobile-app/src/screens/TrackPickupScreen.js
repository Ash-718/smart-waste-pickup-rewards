import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLiveTracking } from "../hooks/useLiveTracking";
import VehicleMarker from "../components/VehicleMarker";
import TrackingBottomSheet from "../components/TrackingBottomSheet";
import { colors } from "../theme/colors";
import { apiFetch } from "../lib/apiClient";

export default function TrackPickupScreen({ route, navigation }) {
  const { pickupId } = route.params || {};
  const mapRef = useRef(null);

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

  const [hasRecentered, setHasRecentered] = useState(false);

  // Pickup destination coordinates (null if not pinned)
  const pickupCoords = trackingData?.pickupCoordinates || null;

  // Fit map camera to show both vehicle and destination
  const recenterMap = () => {
    if (!mapRef.current) return;

    const coordinates = [];
    if (pickupCoords?.lat && pickupCoords?.lng) {
      coordinates.push({ latitude: pickupCoords.lat, longitude: pickupCoords.lng });
    }
    if (vehicleLocation?.lat && vehicleLocation?.lng) {
      coordinates.push({ latitude: vehicleLocation.lat, longitude: vehicleLocation.lng });
    }

    if (coordinates.length >= 2) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
    } else if (coordinates.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  // Auto-recenter on initial vehicle or route load
  useEffect(() => {
    if (!hasRecentered && vehicleLocation?.lat && pickupCoords?.lat) {
      setTimeout(() => {
        recenterMap();
        setHasRecentered(true);
      }, 500);
    }
  }, [hasRecentered, vehicleLocation, pickupCoords]);

  // Handle cancellation
  const handleCancelPickup = () => {
    Alert.alert(
      "Cancel Pickup",
      "Are you sure you want to cancel this pickup request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/pickups/${pickupId}/status`, {
                method: "PATCH",
                body: { status: "cancelled" },
              });
              navigation.goBack();
            } catch (err) {
              Alert.alert("Cancellation Failed", err.message);
            }
          },
        },
      ]
    );
  };

  // Convert route polyline geometry from [lat, lng] to react-native-maps format
  const polylineCoords = (routeNav?.geometry || []).map(([lat, lng]) => ({
    latitude: lat,
    longitude: lng,
  }));

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

  const initialRegion = {
    latitude: vehicleLocation?.lat || pickupCoords?.lat || 19.0544,
    longitude: vehicleLocation?.lng || pickupCoords?.lng || 72.8402,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

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
      {/* 1. Full Screen Interactive Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsCompass={false}
        showsTraffic={false}
      >
        {/* Route Polyline in Brand Green */}
        {polylineCoords.length > 0 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={colors.brand600}
            strokeWidth={4}
            lineDashPattern={status === "assigned" ? [6, 4] : null}
          />
        )}

        {/* Pickup Destination Pin */}
        {pickupCoords?.lat && (
          <Marker
            coordinate={{
              latitude: pickupCoords.lat,
              longitude: pickupCoords.lng,
            }}
            title="Pickup Location"
            description={trackingData?.address}
            tracksViewChanges={false}
          >
            <View style={styles.pickupPin}>
              <Ionicons name="location" size={24} color={colors.red600} />
            </View>
          </Marker>
        )}

        {/* Animated Moving Vehicle Marker */}
        {vehicleLocation?.lat && (
          <VehicleMarker
            location={vehicleLocation}
            registrationNo={trackingData?.vehicle?.registrationNo}
          />
        )}
      </MapView>

      {/* 2. Floating Header: Back & Recenter */}
      <SafeAreaView style={styles.floatingHeader}>
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

        <TouchableOpacity style={styles.circleButton} onPress={recenterMap}>
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

      {/* 4. Draggable Bottom Sheet */}
      <TrackingBottomSheet
        trackingData={trackingData}
        status={status}
        navigation={routeNav}
        connectionState={connectionState}
        isStale={isStale}
        onCancelPickup={["requested", "assigned"].includes(status) ? handleCancelPickup : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.neutral600,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.neutral900,
    marginBottom: 6,
  },
  errorSub: {
    fontSize: 14,
    color: colors.neutral600,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.brand600,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  backLink: {
    marginTop: 14,
    padding: 8,
  },
  backLinkText: {
    color: colors.neutral600,
    fontSize: 14,
    fontWeight: "600",
  },
  floatingHeader: {
    position: "absolute",
    top: Platform.OS === "android" ? 36 : 10,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.neutral900,
  },
  recenterIcon: {
    fontSize: 18,
  },
  statusBanner: {
    backgroundColor: colors.neutral900,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusBannerText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  pickupPin: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinIcon: {
    fontSize: 32,
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
  celebrationEmoji: {
    fontSize: 40,
    marginBottom: 6,
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
