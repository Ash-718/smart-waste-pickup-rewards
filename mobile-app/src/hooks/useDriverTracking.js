import { useState, useEffect, useRef, useCallback } from "react";
import { Platform, Linking, Alert } from "react-native";
import * as Location from "expo-location";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { io } from "socket.io-client";
import { SOCKET_BASE_URL, getAuthToken } from "../lib/apiClient";

/**
 * Calculates Haversine distance in meters between two coordinates.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Hook for foreground GPS tracking and live telemetry broadcast for drivers.
 * Transmits every 3-4s over Socket.IO while trip is on_the_way or arrived.
 */
export function useDriverTracking(status, pickupCoords) {
  const [currentCoords, setCurrentCoords] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [distanceToPickup, setDistanceToPickup] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef(null);
  const locationSubRef = useRef(null);
  const lastKnownCoordsRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const isTripActive = status === "on_the_way" || status === "arrived";

  // 1. Initialize Socket.IO connection
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("reconnect", () => {
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("connect_error", () => {
      setSocketConnected(false);
    });

    return () => {
      socket.off("connect");
      socket.off("reconnect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // 2. Request Foreground Location Permission
  const requestLocationPermission = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        setPermissionGranted(true);
        return true;
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setPermissionError("Location services are disabled on your device.");
        Alert.alert(
          "Enable Location Services",
          "WasteWise requires device GPS to broadcast your pickup vehicle location to the citizen. Please turn on location services in device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }

      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        setPermissionError("Location permission denied. Live tracking is disabled.");
        Alert.alert(
          "Permission Required",
          "WasteWise needs foreground location access while you are driving to share your vehicle's live ETA with the customer.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }

      setPermissionGranted(true);
      setPermissionError(null);
      return true;
    } catch (err) {
      setPermissionError(err.message || "Failed to get location permission");
      return false;
    }
  }, []);

  // Check permission on mount
  useEffect(() => {
    requestLocationPermission();
  }, [requestLocationPermission]);

  // 3. Keep Awake & GPS Tracking Watcher
  useEffect(() => {
    if (!isTripActive || !permissionGranted) {
      setIsSharing(false);
      deactivateKeepAwake("driver_active_trip");
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
      return;
    }

    // Keep screen awake while driving
    activateKeepAwakeAsync("driver_active_trip");
    setIsSharing(true);

    let isSubscribed = true;

    async function startWatching() {
      try {
        if (Platform.OS === "web") {
          // Web fallback using browser geolocation
          if ("geolocation" in navigator) {
            const watchId = navigator.geolocation.watchPosition(
              (pos) => {
                if (!isSubscribed) return;
                const coords = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  speed: Math.round((pos.coords.speed || 0) * 3.6),
                  heading: Math.round(pos.coords.heading || 0),
                  recordedAt: new Date(pos.timestamp).toISOString(),
                };
                lastKnownCoordsRef.current = coords;
                setCurrentCoords(coords);

                if (pickupCoords?.lat && pickupCoords?.lng) {
                  const dist = calculateDistanceMeters(
                    coords.lat,
                    coords.lng,
                    pickupCoords.lat,
                    pickupCoords.lng
                  );
                  setDistanceToPickup(dist);
                }

                if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit("driver:location", coords);
                }
              },
              (err) => console.warn("[DriverGPS] Web error:", err.message),
              { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
            );

            locationSubRef.current = { remove: () => navigator.geolocation.clearWatch(watchId) };
          }
          return;
        }

        // Native iOS & Android foreground watcher (every 3.5s or 10 meters)
        try {
          const initialPos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (initialPos && isSubscribed) {
            const coords = {
              lat: initialPos.coords.latitude,
              lng: initialPos.coords.longitude,
              speed: Math.round((initialPos.coords.speed || 0) * 3.6),
              heading: Math.round(initialPos.coords.heading || 0),
              recordedAt: new Date(initialPos.timestamp).toISOString(),
            };
            lastKnownCoordsRef.current = coords;
            setCurrentCoords(coords);

            if (pickupCoords?.lat && pickupCoords?.lng) {
              const dist = calculateDistanceMeters(
                coords.lat,
                coords.lng,
                pickupCoords.lat,
                pickupCoords.lng
              );
              setDistanceToPickup(dist);
            }

            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit("driver:location", coords);
            }
          }
        } catch (initErr) {
          console.warn("[DriverGPS] Initial position fetch fallback:", initErr.message);
        }

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3500,
            distanceInterval: 10,
          },
          (loc) => {
            if (!isSubscribed) return;
            const coords = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              speed: Math.round((loc.coords.speed || 0) * 3.6),
              heading: Math.round(loc.coords.heading || 0),
              recordedAt: new Date(loc.timestamp).toISOString(),
            };
            lastKnownCoordsRef.current = coords;
            setCurrentCoords(coords);

            // Calculate distance to destination
            if (pickupCoords?.lat && pickupCoords?.lng) {
              const dist = calculateDistanceMeters(
                coords.lat,
                coords.lng,
                pickupCoords.lat,
                pickupCoords.lng
              );
              setDistanceToPickup(dist);
            }

            // Emit telemetry over Socket.IO
            if (socketRef.current && socketRef.current.connected) {
              socketRef.current.emit("driver:location", coords);
            }
          }
        );

        locationSubRef.current = sub;
      } catch (err) {
        console.warn("[DriverGPS] Failed to start location watcher:", err.message);
        setPermissionError(err.message);
      }
    }

    startWatching();

    return () => {
      isSubscribed = false;
      deactivateKeepAwake("driver_active_trip");
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
      setIsSharing(false);
    };
  }, [isTripActive, permissionGranted, pickupCoords]);

  // 4. Heartbeat Effect: Resend location every 10s if vehicle is stationary/stopped
  useEffect(() => {
    if (!isTripActive) {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      return;
    }

    heartbeatTimerRef.current = setInterval(() => {
      if (lastKnownCoordsRef.current && socketRef.current && socketRef.current.connected) {
        const heartbeatCoords = {
          ...lastKnownCoordsRef.current,
          speed: 0,
          recordedAt: new Date().toISOString(),
        };
        socketRef.current.emit("driver:location", heartbeatCoords);
      }
    }, 10000);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isTripActive]);

  return {
    currentCoords,
    isSharing,
    distanceToPickup,
    permissionGranted,
    permissionError,
    socketConnected,
    requestLocationPermission,
  };
}
