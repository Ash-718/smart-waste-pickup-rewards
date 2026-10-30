import React, { useState, useEffect, useRef, useCallback } from "react";
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
  const [telemetryAgeSec, setTelemetryAgeSec] = useState(null);

  const socketRef = useRef(null);
  const staleTimerRef = useRef(null);
  const serverDriftMsRef = useRef(0);
  const lastPacketArrivalMsRef = useRef(null);
  const lastReceivedTimestampRef = useRef(null);
  const latestLocationRef = useRef(null);
  const locationThrottleTimerRef = useRef(null);
  const lastLocationStateUpdateTimeRef = useRef(0);

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
      console.log(`[useLiveTracking] GET /api/pickups/${pickupId}/tracking (silent: ${isSilent})`);
      if (!isSilent) setLoading(true);
      try {
        const res = await getPickupTracking(pickupId);
        if (res && res.tracking) {
          if (res.serverTime) {
            serverDriftMsRef.current = Date.now() - new Date(res.serverTime).getTime();
          }
          const t = res.tracking;
          setTrackingData(t);
          setStatus(t.status);
          setNavigation(t.navigation);

          if (t.vehicle && t.vehicle.location) {
            const loc = t.vehicle.location;
            setVehicleLocation({
              lat: loc.lat,
              lng: loc.lng,
              speed: loc.speed || 0,
              heading: loc.heading || 0,
              recordedAt: loc.recordedAt,
            });

            // Authoritative server age or drift-calibrated calculation
            let initialAgeSec = 0;
            if (loc.ageSeconds !== undefined && loc.ageSeconds !== null) {
              initialAgeSec = loc.ageSeconds;
            } else if (loc.recordedAt) {
              const recordedMs = new Date(loc.recordedAt).getTime();
              initialAgeSec = Math.max(0, Math.round((Date.now() - serverDriftMsRef.current - recordedMs) / 1000));
            }

            const initialStale =
              t.status === "arrived" || t.status === "completed"
                ? false
                : loc.isStale !== undefined
                ? loc.isStale
                : initialAgeSec > 30;

            setIsStale(initialStale);
            setTelemetryAgeSec(initialAgeSec);
            lastPacketArrivalMsRef.current = Date.now() - initialAgeSec * 1000;
            lastReceivedTimestampRef.current = Date.now();
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
      // Once arrived or completed, suppress stale warning
      if (status === "arrived" || status === "completed") {
        setIsStale(false);
        return;
      }

      if (!lastPacketArrivalMsRef.current) {
        return;
      }

      const ageSec = Math.max(0, Math.round((Date.now() - lastPacketArrivalMsRef.current) / 1000));
      setTelemetryAgeSec(ageSec);

      if (["assigned", "on_the_way"].includes(status)) {
        setIsStale(ageSec > 30);
      } else {
        setIsStale(false);
      }
    };

    staleTimerRef.current = setInterval(checkStale, 1000);
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
      transports: ["websocket", "polling"],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
      timeout: 10000,
    });
    socketRef.current = socket;

    // Register incoming telemetry listeners BEFORE emitting room join
    socket.on("vehicle:location", (data) => {
      if (!data || !data.lat || !data.lng) return;

      if (data.serverTime) {
        serverDriftMsRef.current = Date.now() - new Date(data.serverTime).getTime();
      }

      const loc = {
        lat: data.lat,
        lng: data.lng,
        speed: data.speed || 0,
        heading: data.heading || 0,
        recordedAt: data.recordedAt || new Date().toISOString(),
      };

      // Check packet freshness
      let packetAgeSec = 0;
      if (data.recordedAt) {
        const packetRecordedMs = new Date(data.recordedAt).getTime();
        packetAgeSec = Math.max(0, Math.round((Date.now() - serverDriftMsRef.current - packetRecordedMs) / 1000));
      }

      latestLocationRef.current = loc;
      lastPacketArrivalMsRef.current = Date.now() - packetAgeSec * 1000;
      lastReceivedTimestampRef.current = Date.now();
      setTelemetryAgeSec(packetAgeSec);
      setIsStale(packetAgeSec > 30);

      const now = Date.now();
      const timeSinceLastUpdate = now - lastLocationStateUpdateTimeRef.current;

      if (timeSinceLastUpdate >= 2000) {
        lastLocationStateUpdateTimeRef.current = now;
        setVehicleLocation(loc);
      } else if (!locationThrottleTimerRef.current) {
        // Schedule trailing update so latest location is always reflected
        locationThrottleTimerRef.current = setTimeout(() => {
          locationThrottleTimerRef.current = null;
          lastLocationStateUpdateTimeRef.current = Date.now();
          if (latestLocationRef.current) {
            setVehicleLocation(latestLocationRef.current);
          }
        }, 2000 - timeSinceLastUpdate);
      }
    });

    // Handle pickup status transitions
    socket.on("pickup:status", (data) => {
      console.log("[LiveTracking] RECEIVED pickup:status", data);
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

    socket.on("connect", () => {
      console.log(`[LiveTracking] Socket connected (ID: ${socket.id}) to ${SOCKET_BASE_URL}`);
      setConnectionState("connected");
      // Join pickup room
      socket.emit("join:pickup", { pickupId }, (ack) => {
        if (ack?.error) {
          console.warn("[LiveTracking] join:pickup failed:", ack.error);
          setError(ack.error);
        } else {
          console.log(`[LiveTracking] Joined room for pickup ${pickupId}`, ack);
        }
      });
      // Silent sync with REST API
      fetchTracking(true);
    });

    socket.on("reconnect", (attempt) => {
      console.log(`[LiveTracking] Socket reconnected on attempt ${attempt}`);
      setConnectionState("connected");
      socket.emit("join:pickup", { pickupId });
      fetchTracking(true);
      triggerHaptic("impact");
    });

    socket.on("reconnecting", (attempt) => {
      console.log(`[LiveTracking] Socket reconnecting (attempt ${attempt})...`);
      setConnectionState("reconnecting");
    });

    socket.on("disconnect", (reason) => {
      console.log("[LiveTracking] Socket disconnected:", reason);
      setConnectionState("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.warn("[LiveTracking] Socket connect_error:", err.message);
      setConnectionState("reconnecting");
    });

    return () => {
      if (locationThrottleTimerRef.current) {
        clearTimeout(locationThrottleTimerRef.current);
        locationThrottleTimerRef.current = null;
      }
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
    latestLocationRef,
    status,
    navigation,
    loading,
    error,
    connectionState,
    isStale,
    telemetryAgeSec,
    refetch: fetchTracking,
  };
}
