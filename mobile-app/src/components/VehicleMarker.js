import { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, Platform, Animated } from "react-native";
import { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

/**
 * Custom animated vehicle marker.
 * Smoothly interpolates coordinates and heading rotation between telemetry updates to avoid jumps.
 * Optimizes performance with tracksViewChanges={false} after initial layout.
 */
export default function VehicleMarker({ location, registrationNo }) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    return null;
  }

  const { lat, lng, heading = 0 } = location;

  // Coordinate animation ref
  const animatedLat = useRef(new Animated.Value(lat)).current;
  const animatedLng = useRef(new Animated.Value(lng)).current;
  const animatedHeading = useRef(new Animated.Value(heading)).current;

  // Manage tracksViewChanges to avoid perpetual re-rendering on Android/iOS
  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [lat, lng, heading]);

  useEffect(() => {
    // Smoothly animate towards new coordinates over 2.5s (smooth 60fps interpolation)
    Animated.parallel([
      Animated.timing(animatedLat, {
        toValue: lat,
        duration: 2500,
        useNativeDriver: false,
      }),
      Animated.timing(animatedLng, {
        toValue: lng,
        duration: 2500,
        useNativeDriver: false,
      }),
      Animated.timing(animatedHeading, {
        toValue: heading,
        duration: 1200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [lat, lng, heading, animatedLat, animatedLng, animatedHeading]);

  const rotationInterpolation = animatedHeading.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.container}>
        {/* Subtle pulsating radar halo */}
        <View style={styles.halo} />

        {/* Rotated Truck Compass Badge */}
        <Animated.View
          style={[
            styles.badge,
            {
              transform: [{ rotate: rotationInterpolation }],
            },
          ]}
        >
          {/* Direction indicator arrow */}
          <View style={styles.pointer} />
          {/* Truck Vector Icon */}
          <Ionicons name="car" size={20} color={colors.white} />
        </Animated.View>

        {/* Registration pill */}
        {registrationNo ? (
          <View style={styles.regPill}>
            <Text style={styles.regText}>{registrationNo}</Text>
          </View>
        ) : null}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
  },
  halo: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(22, 163, 74, 0.2)",
    borderWidth: 1.5,
    borderColor: colors.brand600,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  pointer: {
    position: "absolute",
    top: -5,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: colors.white,
  },
  icon: {
    fontSize: 20,
  },
  regPill: {
    position: "absolute",
    bottom: 2,
    backgroundColor: colors.neutral900,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  regText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
