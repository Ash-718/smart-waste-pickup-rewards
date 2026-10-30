import React, { useRef, useState, useEffect, useMemo, useCallback, useImperativeHandle, forwardRef } from "react";
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../theme/colors";

const DEFAULT_TILE_URL =
  process.env.EXPO_PUBLIC_TILE_URL ||
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

function sanitizeNumber(val, fallback = null) {
  if (val === null || val === undefined || val === "") return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

// Downsample route coordinates to under 300 points for smooth performance
function downsampleRoute(points, maxPoints = 280) {
  if (!points || !Array.isArray(points) || points.length <= maxPoints) {
    return points || [];
  }
  const step = Math.ceil(points.length / maxPoints);
  const result = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) {
    result.push(last);
  }
  return result;
}

// Convert route points to [[lat, lng], ...] ensuring strictly finite numbers
function normalizeRoutePoints(points) {
  if (!points || !Array.isArray(points)) return [];
  return downsampleRoute(points)
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) {
        const lat = sanitizeNumber(p[0]);
        const lng = sanitizeNumber(p[1]);
        if (lat !== null && lng !== null) return [lat, lng];
      }
      if (p && typeof p === "object") {
        const lat = sanitizeNumber(p.latitude !== undefined ? p.latitude : p.lat);
        const lng = sanitizeNumber(p.longitude !== undefined ? p.longitude : p.lng);
        if (lat !== null && lng !== null) return [lat, lng];
      }
      return null;
    })
    .filter(Boolean);
}

function generateLeafletHtml(tileUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map {
      width: 100%;
      height: 100%;
      background-color: #F8FAFC;
      overflow: hidden;
    }
    .leaflet-control-attribution {
      font-size: 9px !important;
      background: rgba(255, 255, 255, 0.75) !important;
      padding: 1px 4px !important;
    }
    .pickup-icon-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.3));
    }
    .truck-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.35));
    }
    .truck-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      will-change: transform;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function sendToRN(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    var map = null;
    var tileLayer = null;
    var pickupMarker = null;
    var arrivalCircle = null;
    var vehicleMarker = null;
    var routePolyline = null;
    var hasFittedInitial = false;
    var tileFailCount = 0;

    var curVehicle = { lat: null, lng: null, heading: 0 };
    var animStart = null;
    var animStartLat = null;
    var animStartLng = null;
    var animStartHeading = 0;
    var animTargetLat = null;
    var animTargetLng = null;
    var animTargetHeading = 0;
    var animDuration = 600;

    function createPickupIcon() {
      var html = '<div class="pickup-icon-wrapper">' +
        '<svg width="30" height="36" viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M15 0C6.716 0 0 6.716 0 15C0 24 13.5 34.5 15 35.5C16.5 34.5 30 24 30 15C30 6.716 23.284 0 15 0Z" fill="#DC2626"/>' +
          '<circle cx="15" cy="14" r="5" fill="#FFFFFF"/>' +
        '</svg>' +
      '</div>';
      return L.divIcon({
        className: 'custom-pickup-icon',
        html: html,
        iconSize: [30, 36],
        iconAnchor: [15, 36]
      });
    }

    function createTruckIcon(heading) {
      var h = heading || 0;
      var html = '<div class="truck-icon-wrapper">' +
        '<div class="truck-inner" id="truck-body" style="transform: rotate(' + h + 'deg);">' +
          '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="20" cy="20" r="17.5" fill="#059669" stroke="#FFFFFF" stroke-width="2.5"/>' +
            '<path d="M12 15H21V25H12V15Z" fill="#FFFFFF"/>' +
            '<path d="M21 18H25L27.5 21.5V25H21V18Z" fill="#FFFFFF"/>' +
            '<circle cx="15.5" cy="25" r="2.2" fill="#1E293B" stroke="#FFFFFF" stroke-width="0.8"/>' +
            '<circle cx="24.5" cy="25" r="2.2" fill="#1E293B" stroke="#FFFFFF" stroke-width="0.8"/>' +
            '<rect x="22" y="19" width="3" height="2.5" rx="0.5" fill="#059669"/>' +
          '</svg>' +
        '</div>' +
      '</div>';
      return L.divIcon({
        className: 'custom-truck-icon',
        html: html,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    }

    function easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function stepVehicleAnimation(timestamp) {
      if (!animStart) animStart = timestamp;
      var elapsed = timestamp - animStart;
      var progress = Math.min(elapsed / animDuration, 1);
      var ease = easeInOutQuad(progress);

      var newLat = animStartLat + (animTargetLat - animStartLat) * ease;
      var newLng = animStartLng + (animTargetLng - animStartLng) * ease;

      var diff = ((animTargetHeading - animStartHeading + 540) % 360) - 180;
      var newHeading = animStartHeading + diff * ease;

      curVehicle.lat = newLat;
      curVehicle.lng = newLng;
      curVehicle.heading = newHeading;

      if (vehicleMarker) {
        vehicleMarker.setLatLng([newLat, newLng]);
        var el = document.getElementById('truck-body');
        if (el) {
          el.style.transform = 'rotate(' + newHeading + 'deg)';
        }
      }

      if (progress < 1) {
        requestAnimationFrame(stepVehicleAnimation);
      } else {
        animStart = null;
      }
    }

    function updateVehicle(v) {
      if (!v || typeof v !== 'object') return;
      var targetLat = typeof v.lat === 'number' && !isNaN(v.lat) ? v.lat : null;
      var targetLng = typeof v.lng === 'number' && !isNaN(v.lng) ? v.lng : null;
      var targetHeading = typeof v.heading === 'number' && !isNaN(v.heading) ? v.heading : 0;

      if (targetLat === null || targetLng === null) return;

      if (!vehicleMarker) {
        curVehicle = { lat: targetLat, lng: targetLng, heading: targetHeading };
        vehicleMarker = L.marker([targetLat, targetLng], {
          icon: createTruckIcon(targetHeading),
          zIndexOffset: 1000
        }).addTo(map);

        if (!hasFittedInitial) {
          fitAllBounds();
        }
        return;
      }

      // Smooth interpolation animation
      animStart = null;
      animStartLat = curVehicle.lat != null ? curVehicle.lat : targetLat;
      animStartLng = curVehicle.lng != null ? curVehicle.lng : targetLng;
      animStartHeading = curVehicle.heading || 0;
      animTargetLat = targetLat;
      animTargetLng = targetLng;
      animTargetHeading = targetHeading;

      requestAnimationFrame(stepVehicleAnimation);
    }

    function updatePickup(p) {
      if (!p || typeof p !== 'object' || p.lat == null || p.lng == null || isNaN(p.lat) || isNaN(p.lng)) {
        if (pickupMarker && map) {
          map.removeLayer(pickupMarker);
          pickupMarker = null;
        }
        if (arrivalCircle && map) {
          map.removeLayer(arrivalCircle);
          arrivalCircle = null;
        }
        return;
      }

      var lat = Number(p.lat);
      var lng = Number(p.lng);

      if (!pickupMarker) {
        pickupMarker = L.marker([lat, lng], {
          icon: createPickupIcon(),
          zIndexOffset: 500
        }).addTo(map);
      } else {
        pickupMarker.setLatLng([lat, lng]);
      }

      if (showArrivalZone) {
        if (!arrivalCircle) {
          arrivalCircle = L.circle([lat, lng], {
            radius: 300,
            color: '#059669',
            fillColor: '#10b981',
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: '5, 5'
          }).addTo(map);
        } else {
          arrivalCircle.setLatLng([lat, lng]);
        }
      } else if (arrivalCircle && map) {
        map.removeLayer(arrivalCircle);
        arrivalCircle = null;
      }

      if (!hasFittedInitial) {
        fitAllBounds();
      }
    }

    function updateRoute(coords) {
      if (!coords || !Array.isArray(coords) || !coords.length) {
        if (routePolyline && map) {
          map.removeLayer(routePolyline);
          routePolyline = null;
        }
        return;
      }

      if (!routePolyline) {
        routePolyline = L.polyline(coords, {
          color: '#059669',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);
      } else {
        routePolyline.setLatLngs(coords);
      }

      if (!hasFittedInitial) {
        fitAllBounds();
      }
    }

    function fitAllBounds() {
      if (!map) return;
      var bounds = [];
      if (curVehicle.lat != null && curVehicle.lng != null && !isNaN(curVehicle.lat) && !isNaN(curVehicle.lng)) {
        bounds.push([curVehicle.lat, curVehicle.lng]);
      }
      if (pickupMarker) {
        var pPos = pickupMarker.getLatLng();
        if (pPos && !isNaN(pPos.lat) && !isNaN(pPos.lng)) {
          bounds.push([pPos.lat, pPos.lng]);
        }
      }

      if (bounds.length === 0) return;

      if (bounds.length === 1) {
        map.setView(bounds[0], 16, { animate: true });
      } else {
        var latLngBounds = L.latLngBounds(bounds);
        map.fitBounds(latLngBounds, {
          padding: [70, 70],
          maxZoom: 16,
          animate: true
        });
      }
      hasFittedInitial = true;
    }

    function initMap() {
      try {
        map = L.map('map', {
          zoomControl: false,
          attributionControl: true
        }).setView([19.0760, 72.8777], 13);

        tileLayer = L.tileLayer('${tileUrl}', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(map);

        tileLayer.on('tileerror', function() {
          tileFailCount++;
          if (tileFailCount === 10) {
            sendToRN({ type: 'tilefail', count: tileFailCount });
          }
        });

        sendToRN({ type: 'ready' });
      } catch (err) {
        sendToRN({ type: 'error', message: err.message || 'Map init failed' });
      }
    }

    function handleRNMessage(event) {
      if (!event || typeof event.data !== 'string') return;
      try {
        var msg = JSON.parse(event.data);
        if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
        if (msg.type === 'updateVehicle') {
          updateVehicle(msg.vehicle);
        } else if (msg.type === 'updatePickup') {
          updatePickup(msg.pickup, Boolean(msg.showArrivalZone));
        } else if (msg.type === 'updateRoute') {
          updateRoute(msg.route);
        } else if (msg.type === 'recenter') {
          fitAllBounds();
          sendToRN({ type: 'recentered' });
        }
      } catch (e) {
        console.error('Leaflet bridge message error:', e);
      }
    }

    window.addEventListener('message', handleRNMessage);
    document.addEventListener('message', handleRNMessage);

    if (window.L) {
      initMap();
    } else {
      window.addEventListener('load', function() {
        if (window.L) initMap();
        else sendToRN({ type: 'error', message: 'Leaflet library failed to load' });
      });
    }
  </script>
</body>
</html>`;
}

const LeafletMap = forwardRef(function LeafletMap(
  {
    pickup,
    vehicle,
    route,
    showArrivalZone = false,
    onReady,
    onError,
    onRecenter,
    style,
  },
  ref
) {
  const webViewRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Memoize HTML string so it is NOT re-created on each render
  const htmlContent = useMemo(() => {
    return generateLeafletHtml(DEFAULT_TILE_URL);
  }, []);

  const postBridgeMessage = useCallback((data) => {
    if (webViewRef.current) {
      const jsonString = JSON.stringify(data);
      // Safely inject JSON via JSON.stringify to prevent script injection vulnerabilities
      const script = `(function() {
        try {
          var event = { data: ${JSON.stringify(jsonString)} };
          if (typeof handleRNMessage === 'function') {
            handleRNMessage(event);
          }
        } catch(e) {
          console.error('[LeafletMap] injected script error:', e);
        }
      })();`;
      webViewRef.current.injectJavaScript(script);
    }
  }, []);

  // Expose recenter method to parent
  useImperativeHandle(
    ref,
    () => ({
      recenter: () => {
        postBridgeMessage({ type: "recenter" });
      },
    }),
    [postBridgeMessage]
  );

  // Validate onMessage payloads
  const handleWebViewMessage = useCallback(
    (event) => {
      if (!event || !event.nativeEvent || typeof event.nativeEvent.data !== "string") {
        return;
      }
      let data;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch (err) {
        console.warn("[LeafletMap] Failed to parse bridge message JSON:", err);
        return;
      }
      if (!data || typeof data !== "object" || typeof data.type !== "string") {
        console.warn("[LeafletMap] Invalid message format:", data);
        return;
      }

      switch (data.type) {
        case "ready":
          setIsReady(true);
          setHasError(false);
          if (onReady) onReady();
          break;
        case "error":
          setHasError(true);
          setErrorMessage(typeof data.message === "string" ? data.message : "Failed to load map");
          if (onError) onError(data.message);
          break;
        case "tilefail":
          setHasError(true);
          setErrorMessage("Map tiles could not be loaded. Please check your internet connection.");
          if (onError) onError("Tile loading failed");
          break;
        case "recentered":
          if (onRecenter) onRecenter();
          break;
        default:
          break;
      }
    },
    [onReady, onError, onRecenter]
  );

  // Sanitized vehicle numbers
  const sanitizedVehicle = useMemo(() => {
    if (!vehicle) return null;
    const lat = sanitizeNumber(vehicle.lat !== undefined ? vehicle.lat : vehicle.latitude);
    const lng = sanitizeNumber(vehicle.lng !== undefined ? vehicle.lng : vehicle.longitude);
    const heading = sanitizeNumber(vehicle.heading, 0);
    if (lat === null || lng === null) return null;
    return { lat, lng, heading };
  }, [vehicle?.lat, vehicle?.lng, vehicle?.latitude, vehicle?.longitude, vehicle?.heading]);

  // Send updates to WebView whenever vehicle changes
  useEffect(() => {
    if (!isReady || !sanitizedVehicle) return;
    postBridgeMessage({
      type: "updateVehicle",
      vehicle: sanitizedVehicle,
    });
  }, [isReady, sanitizedVehicle, postBridgeMessage]);

  // Sanitized pickup numbers (safely handles null/undefined pickup without crashing)
  const sanitizedPickup = useMemo(() => {
    if (!pickup) return null;
    const lat = sanitizeNumber(pickup.lat !== undefined ? pickup.lat : pickup.latitude);
    const lng = sanitizeNumber(pickup.lng !== undefined ? pickup.lng : pickup.longitude);
    if (lat === null || lng === null) return null;
    return { lat, lng };
  }, [pickup?.lat, pickup?.lng, pickup?.latitude, pickup?.longitude]);

  // Send updates to WebView whenever pickup changes
  useEffect(() => {
    if (!isReady) return;
    postBridgeMessage({
      type: "updatePickup",
      pickup: sanitizedPickup,
      showArrivalZone: Boolean(showArrivalZone),
    });
  }, [isReady, sanitizedPickup, showArrivalZone, postBridgeMessage]);

  // Send updates to WebView whenever route changes
  const normalizedRoute = useMemo(() => normalizeRoutePoints(route), [route]);
  useEffect(() => {
    if (!isReady) return;
    postBridgeMessage({
      type: "updateRoute",
      route: normalizedRoute,
    });
  }, [isReady, normalizedRoute, postBridgeMessage]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsReady(false);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        originWhitelist={["https://*", "about:blank"]}
        source={{ html: htmlContent }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleWebViewMessage}
        onError={() => {
          setHasError(true);
          setErrorMessage("Failed to load map component");
        }}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
      />

      {/* Loading Overlay */}
      {!isReady && !hasError && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.brand600} />
          <Text style={styles.loadingText}>Loading live map...</Text>
        </View>
      )}

      {/* Error / TileFail Overlay */}
      {hasError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Map Offline</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#F8FAFC",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.neutral600,
    fontWeight: "600",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248, 250, 252, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral900,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.neutral600,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: colors.brand600,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
});

export default React.memo(LeafletMap);
