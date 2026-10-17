import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLiveTracking } from "../hooks/useLiveTracking";
import VehicleMarker from "../components/VehicleMarker";
import TrackingBottomSheet from "../components/TrackingBottomSheet";
import { colors } from "../theme/colors";
import { apiFetch } from "../lib/apiClient";

export default function TrackPickupScreen({ route, navigation }) {
  const { pickupId } = route.params || {};
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

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
    if (vehicleLocation?.lat && vehicleLocation?.lng) {
      coordinates.push({
        latitude: vehicleLocation.lat,
        longitude: vehicleLocation.lng,
      });
    }
    if (pickupCoords?.lat && pickupCoords?.lng) {
      coordinates.push({
        latitude: pickupCoords.lat,
        longitude: pickupCoords.lng,
      });
    }

    if (coordinates.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: coordinates[0].latitude,
          longitude: coordinates[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800
      );
    } else if (coordinates.length > 1) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 60, bottom: 280, left: 60 },
        animated: true,
      });
    }
  };

  // Initial recenter once tracking data arrives
  useEffect(() => {
    if (!hasRecentered && (vehicleLocation?.lat || pickupCoords?.lat)) {
      recenterMap();
      setHasRecentered(true);
    }
  }, [vehicleLocation?.lat, pickupCoords?.lat, hasRecentered]);

  // Decode OSRM route geometry polyline coordinates
  const polylineCoords = (routeNav?.geometry?.coordinates || []).map((coord) => ({
    latitude: coord[1],
    longitude: coord[0],
  }));

  // Handle Cancel Pickup
  const handleCancelPickup = () => {
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
  };

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
    latitude: vehicleLocation?.lat || pickupCoords?.lat || 16.8413,
    longitude: vehicleLocation?.lng || pickupCoords?.lng || 74.6016,
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
      {/* 1. Full Screen Interactive Map with OpenStreetMap Tiles */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        mapType="none"
        onMapReady={() => setMapReady(true)}
        onError={(e) => console.warn("[TrackPickup] MapView error:", e?.nativeEvent || e)}
        showsUserLocation={false}
        showsCompass={false}
        showsTraffic={false}
      >
        {/* OpenStreetMap Raster Tile Layer (Zero Google API key required) */}
        <UrlTile
          urlTemplate={process.env.EXPO_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
          maximumZ={19}
          flipY={false}
          zIndex={-1}
        />

        {/* Route Polyline in Brand Green */}
        {polylineCoords.length > 0 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={colors.brand600}
            strokeWidth={4}
            lineDashPattern={status === "assigned" ? [6, 4] : null}
          />
        )}

        {/* Pickup Destination Pin - 100% Pure View Marker (Zero Icon Font Dependency) */}
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
            <View style={styles.pickupPinContainer}>
              <View style={styles.pickupPinCircle}>
                <View style={styles.pickupPinInnerDot} />
              </View>
              <View style={styles.pickupPinTriangle} />
            </View>
          </Marker>
        )}

        {/* Animated Moving Vehicle Marker (Pure View Marker) */}
        {vehicleLocation?.lat && (
          <VehicleMarker
            location={vehicleLocation}
            registrationNo={trackingData?.vehicle?.registrationNo}
          />
        )}
      </MapView>

      {/* Map Attribution Text */}
      <View style={styles.attributionContainer} pointerEvents="none">
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>

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
    flex: 1,
    width: "100%",
    height: "100%",
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
    top: 10,
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
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
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
  pickupPinContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 38,
  },
  pickupPinCircle: {
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
  pickupPinInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  pickupPinTriangle: {
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
  attributionContainer: {
    position: "absolute",
    bottom: 240,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 5,
  },
  attributionText: {
    fontSize: 9,
    color: colors.neutral600,
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
