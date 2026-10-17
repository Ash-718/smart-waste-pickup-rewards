import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, Animated, Platform } from "react-native";
import { Marker } from "react-native-maps";
import { colors } from "../theme/colors";

/**
 * Custom animated vehicle marker.
 * Built with 100% pure Views (ZERO icon font dependency) so it renders immediately and reliably on all devices.
 * Smoothly interpolates coordinates and heading rotation between telemetry updates to avoid jumps.
 * On Android, uses native markerRef.animateMarkerToCoordinate for high-performance fluid tracking.
 */
function VehicleMarker({ location, registrationNo }) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const markerRef = useRef(null);
  const prevCoordRef = useRef(location ? { lat: location.lat, lng: location.lng } : null);

  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
    return null;
  }

  const { lat, lng, heading = 0 } = location;

  // Animate coordinate smoothly on Android using native driver
  useEffect(() => {
    if (Platform.OS === "android" && markerRef.current?.animateMarkerToCoordinate) {
      if (!prevCoordRef.current || prevCoordRef.current.lat !== lat || prevCoordRef.current.lng !== lng) {
        prevCoordRef.current = { lat, lng };
        markerRef.current.animateMarkerToCoordinate({ latitude: lat, longitude: lng }, 2000);
      }
    }
  }, [lat, lng]);

  // Coordinate animation ref for JS-driven rotation/fallback
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
    // Smoothly animate towards new heading and coordinates
    Animated.parallel([
      Animated.timing(animatedLat, {
        toValue: lat,
        duration: 2000,
        useNativeDriver: false,
      }),
      Animated.timing(animatedLng, {
        toValue: lng,
        duration: 2000,
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
      ref={markerRef}
      coordinate={{ latitude: lat, longitude: lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={true}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.container}>
        {/* Subtle pulsating radar halo */}
        <View style={styles.halo} />

        {/* Rotated Vehicle Compass Badge */}
        <Animated.View
          style={[
            styles.badge,
            {
              transform: [{ rotate: rotationInterpolation }],
            },
          ]}
        >
          {/* Direction indicator pointer */}
          <View style={styles.pointer} />

          {/* Pure View-based Vehicle Glyph (Zero font dependency) */}
          <View style={styles.vehicleChassis}>
            <View style={styles.vehicleCab} />
            <View style={styles.vehicleBed} />
            <View style={styles.headlightLeft} />
            <View style={styles.headlightRight} />
          </View>
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
  vehicleChassis: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleCab: {
    width: 13,
    height: 8,
    backgroundColor: colors.white,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  vehicleBed: {
    width: 17,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 2,
    marginTop: 1,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  headlightLeft: {
    position: "absolute",
    top: 1,
    left: 4,
    width: 3,
    height: 2,
    backgroundColor: "#FDE047",
    borderRadius: 1,
  },
  headlightRight: {
    position: "absolute",
    top: 1,
    right: 4,
    width: 3,
    height: 2,
    backgroundColor: "#FDE047",
    borderRadius: 1,
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

export default React.memo(VehicleMarker);
