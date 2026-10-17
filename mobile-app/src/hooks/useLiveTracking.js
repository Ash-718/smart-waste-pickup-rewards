import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";
import { io } from "socket.io-client";
import * as Haptics from "expo-haptics";
import { getPickupTracking } from "../api/pickups";
import { SOCKET_BASE_URL, getAuthToken } from "../lib/apiClient";

export function useLiveTracking(pickupId) {
  const [trackingData, setTrackingData] = useState(null);
  const [vehicleLocation, setVehicleLocation] = useState(null);
  const [status, setStatus] = useState("requested");
  const [navigation, setNavigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting"); // connecting, connected, reconnecting, disconnected
  const [isStale, setIsStale] = useState(false);

  const socketRef = useRef(null);
  const staleTimerRef = useRef(null);
  const lastLocationTimestampRef = useRef(null);

  // Trigger haptic feedback safely
  const triggerHaptic = useCallback(async (type = "impact") => {
    try {
      if (Platform.OS !== "web") {
        if (type === "success") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === "warning") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    } catch {
      // Ignore haptics errors if device doesn't support
    }
  }, []);

  // Fetch full tracking payload from REST API
  const fetchTracking = useCallback(
    async (isSilent = false) => {
      if (!pickupId) return;
      if (!isSilent) setLoading(true);
      try {
        const res = await getPickupTracking(pickupId);
        if (res && res.tracking) {
          const t = res.tracking;
          setTrackingData(t);
          setStatus(t.status);
          setNavigation(t.navigation);

          if (t.vehicle && t.vehicle.location) {
            setVehicleLocation({
              lat: t.vehicle.location.lat,
              lng: t.vehicle.location.lng,
              speed: t.vehicle.location.speed || 0,
              heading: t.vehicle.location.heading || 0,
              recordedAt: t.vehicle.location.recordedAt,
            });
            setIsStale(t.status === "arrived" ? false : t.vehicle.location.isStale || false);
            lastLocationTimestampRef.current = t.vehicle.location.recordedAt
              ? new Date(t.vehicle.location.recordedAt).getTime()
              : Date.now();
          }
        }
        setError(null);
      } catch (err) {
        console.warn("[LiveTracking] Error fetching tracking data:", err.message);
        setError(err.message || "Unable to load pickup tracking details");
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [pickupId]
  );

  // Watch for stale locations (>30s without update while in transit)
  useEffect(() => {
    const checkStale = () => {
      // Once arrived, the vehicle is waiting at the citizen's doorstep; suppress stale warning
      if (status === "arrived") {
        setIsStale(false);
        return;
      }

      if (
        ["assigned", "on_the_way"].includes(status) &&
        lastLocationTimestampRef.current
      ) {
        const ageSec = (Date.now() - lastLocationTimestampRef.current) / 1000;
        setIsStale(ageSec > 30);
      } else {
        setIsStale(false);
      }
    };

    staleTimerRef.current = setInterval(checkStale, 5000);
    return () => {
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    };
  }, [status]);

  // AppState listener: re-fetch tracking state when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        fetchTracking(true);
      }
    });
    return () => subscription.remove();
  }, [fetchTracking]);

  // Main Socket.IO connection and room lifecycle
  useEffect(() => {
    if (!pickupId) return;

    fetchTracking(false);

    const token = getAuthToken();
    if (!token) {
      setConnectionState("disconnected");
      return;
    }

    const socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
      // Join pickup room
      socket.emit("join:pickup", { pickupId }, (ack) => {
        if (ack?.error) {
          setError(ack.error);
        }
      });
      // Silent sync with REST API
      fetchTracking(true);
    });

    socket.on("reconnect", () => {
      setConnectionState("connected");
      socket.emit("join:pickup", { pickupId });
      fetchTracking(true);
      triggerHaptic("impact");
    });

    socket.on("reconnecting", () => {
      setConnectionState("reconnecting");
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    socket.on("connect_error", () => {
      setConnectionState("reconnecting");
    });

    // Handle live vehicle movement
    socket.on("vehicle:location", (data) => {
      if (data && data.lat && data.lng) {
        setVehicleLocation({
          lat: data.lat,
          lng: data.lng,
          speed: data.speed || 0,
          heading: data.heading || 0,
          recordedAt: data.recordedAt || new Date().toISOString(),
        });
        lastLocationTimestampRef.current = Date.now();
        setIsStale(false);
      }
    });

    // Handle pickup status transitions
    socket.on("pickup:status", (data) => {
      if (data && data.status) {
        setStatus(data.status);
        if (data.status === "completed") {
          triggerHaptic("success");
        } else {
          triggerHaptic("impact");
        }
        // Refetch full payload to update timestamps and points
        fetchTracking(true);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave:pickup", { pickupId });
        socketRef.current.off("connect");
        socketRef.current.off("reconnect");
        socketRef.current.off("reconnecting");
        socketRef.current.off("disconnect");
        socketRef.current.off("connect_error");
        socketRef.current.off("vehicle:location");
        socketRef.current.off("pickup:status");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [pickupId, fetchTracking, triggerHaptic]);

  return {
    trackingData,
    vehicleLocation,
    status,
    navigation,
    loading,
    error,
    connectionState,
    isStale,
    refetch: fetchTracking,
  };
}
