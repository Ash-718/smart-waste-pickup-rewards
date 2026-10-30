import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import { listDriverPickups } from "../api/driver";
import { colors } from "../theme/colors";

export default function DriverHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState("active"); // 'active' | 'history'
  const [gpsStatus, setGpsStatus] = useState("checking"); // 'ready' | 'permission_needed' | 'services_disabled' | 'checking'

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["driverPickups"],
    queryFn: listDriverPickups,
    refetchInterval: isFocused ? 10000 : false,
  });

  const pickups = data?.pickups || [];
  const history = data?.history || [];
  const vehicle = data?.vehicle;
  const driverProfile = data?.driver || user;

  // Check GPS permission and services
  const checkGps = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        setGpsStatus("ready");
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setGpsStatus("services_disabled");
        return;
      }

      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === "granted") {
        setGpsStatus("ready");
      } else {
        setGpsStatus("permission_needed");
      }
    } catch {
      setGpsStatus("permission_needed");
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      checkGps();
    }
  }, [isFocused, checkGps]);

  const requestGps = async () => {
    try {
      if (Platform.OS === "web") return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setGpsStatus("ready");
      } else {
        Alert.alert(
          "Location Permission",
          "Foreground location permission is required for live route navigation and customer ETA updates.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch {
      // Ignored
    }
  };

  const renderPickupCard = ({ item }) => {
    const isActionRequired = item.status === "on_the_way" || item.status === "arrived";

    return (
      <TouchableOpacity
        style={[styles.card, isActionRequired && styles.cardActive]}
        onPress={() => navigation.navigate("DriverJob", { pickupId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                item.status === "on_the_way" && styles.dotOnTheWay,
                item.status === "arrived" && styles.dotArrived,
              ]}
            />
            <Text style={styles.statusLabel}>
              {item.status === "assigned" && "Assigned (Ready to Start)"}
              {item.status === "on_the_way" && "Trip in Progress 🛰️"}
              {item.status === "arrived" && "Arrived at Customer 📍"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.neutral400} />
        </View>

        <Text style={styles.addressText} numberOfLines={2}>
          {item.address}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Customer</Text>
            <Text style={styles.metaValue}>{item.user?.name || "Citizen"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Waste Type</Text>
            <Text style={styles.metaValue}>{item.wasteType || "Recyclables"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Slot</Text>
            <Text style={styles.metaValue}>{item.slotPeriod || "Morning"}</Text>
          </View>
        </View>

        <View style={[styles.actionBtn, isActionRequired && styles.actionBtnActive]}>
          <Text style={[styles.actionBtnText, isActionRequired && styles.actionBtnTextActive]}>
            {item.status === "assigned"
              ? "Open Job & Start Trip →"
              : item.status === "on_the_way"
              ? "Continue Trip Navigation →"
              : "Complete Pickup Verification →"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoryCard = ({ item }) => {
    const completedDate = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "Recently";
    const completedTime = item.updatedAt
      ? new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyCardHeader}>
          <View style={styles.historyBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.brand700} style={{ marginRight: 4 }} />
            <Text style={styles.historyBadgeText}>Completed</Text>
          </View>
          <Text style={styles.historyDate}>
            {completedDate} {completedTime}
          </Text>
        </View>

        <Text style={styles.historyAddress} numberOfLines={2}>
          {item.address}
        </Text>

        <View style={styles.historyFooter}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Customer</Text>
            <Text style={styles.metaValue}>{item.user?.name || "Citizen"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Waste Type</Text>
            <Text style={styles.metaValue}>{item.wasteType || "Mixed"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Weight</Text>
            <Text style={[styles.metaValue, { color: colors.brand700, fontWeight: "700" }]}>
              {item.wasteQuantity ? `${item.wasteQuantity} kg` : "Recorded"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Driver Profile Header */}
      <View style={styles.header}>
        <View style={styles.driverProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(driverProfile?.name || "C").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <View style={styles.roleBadgeRow}>
              <Text style={styles.driverName}>{driverProfile?.name || "Fleet Collector"}</Text>
              <View style={styles.collectorRolePill}>
                <Text style={styles.collectorRoleText}>COLLECTOR</Text>
              </View>
            </View>
            <Text style={styles.driverContact}>
              {driverProfile?.phone || driverProfile?.email || "Authorized Fleet Driver"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={logout}
          style={styles.logoutBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.neutral600} />
        </TouchableOpacity>
      </View>

      {/* Vehicle Status Banner */}
      <View style={styles.vehicleBanner}>
        <View style={styles.vehicleInfo}>
          <View style={styles.vehicleIconCircle}>
            <Ionicons name="car-sport" size={20} color={colors.brand700} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vehicleReg}>
              {vehicle?.registrationNo || "Vehicle Unassigned"}
            </Text>
            <Text style={styles.vehicleType}>
              {vehicle
                ? `${vehicle.type} • ${vehicle.capacity} kg capacity`
                : "Awaiting administrator vehicle assignment"}
            </Text>
          </View>
        </View>
        {vehicle && (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>Active Fleet</Text>
          </View>
        )}
      </View>

      {/* GPS Status Indicator Banner */}
      <TouchableOpacity
        onPress={gpsStatus !== "ready" ? requestGps : undefined}
        style={[
          styles.gpsBanner,
          gpsStatus === "ready"
            ? styles.gpsBannerReady
            : gpsStatus === "services_disabled"
            ? styles.gpsBannerDisabled
            : styles.gpsBannerWarning,
        ]}
        activeOpacity={gpsStatus !== "ready" ? 0.7 : 1}
      >
        <Ionicons
          name={
            gpsStatus === "ready"
              ? "location"
              : gpsStatus === "services_disabled"
              ? "alert-circle"
              : "navigate-circle"
          }
          size={18}
          color={
            gpsStatus === "ready"
              ? colors.brand700
              : gpsStatus === "services_disabled"
              ? colors.red700
              : "#b45309"
          }
        />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text
            style={[
              styles.gpsBannerTitle,
              {
                color:
                  gpsStatus === "ready"
                    ? colors.brand800
                    : gpsStatus === "services_disabled"
                    ? colors.red800
                    : "#92400e",
              },
            ]}
          >
            {gpsStatus === "ready"
              ? "GPS & Foreground Tracking Ready"
              : gpsStatus === "services_disabled"
              ? "Device Location Services Disabled"
              : "Foreground GPS Permission Required"}
          </Text>
          <Text
            style={[
              styles.gpsBannerSub,
              {
                color:
                  gpsStatus === "ready"
                    ? colors.brand600
                    : gpsStatus === "services_disabled"
                    ? colors.red600
                    : "#b45309",
              },
            ]}
          >
            {gpsStatus === "ready"
              ? "Telemetry broadcasts automatically during active trips (3s rate limit, 300m geofence)."
              : "Tap here to grant location permission for live route navigation and arrival detection."}
          </Text>
        </View>
        {gpsStatus !== "ready" && (
          <Ionicons name="chevron-forward" size={16} color="#b45309" />
        )}
      </TouchableOpacity>

      {/* Tab Switcher: Active Jobs vs Pickup History */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab("active")}
          style={[styles.tabButton, activeTab === "active" && styles.tabButtonActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === "active" && styles.tabButtonTextActive]}>
            Active Pickups ({pickups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("history")}
          style={[styles.tabButton, activeTab === "history" && styles.tabButtonActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === "history" && styles.tabButtonTextActive]}>
            Pickup History ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main List */}
      <FlatList
        data={activeTab === "active" ? pickups : history}
        keyExtractor={(item) => item.id}
        renderItem={activeTab === "active" ? renderPickupCard : renderHistoryCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            colors={[colors.brand600]}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={
                  activeTab === "active"
                    ? "checkmark-done-circle-outline"
                    : "time-outline"
                }
                size={52}
                color={colors.brand600}
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === "active" ? "All Caught Up!" : "No Completed Pickups Yet"}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === "active"
                  ? "There are no pending pickups assigned to your vehicle right now. New assignments dispatched by administrators will appear here automatically."
                  : "Completed pickup jobs and weight logs will appear here after you mark jobs finished."}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral200,
  },
  driverProfile: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
  },
  roleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.neutral900,
  },
  collectorRolePill: {
    backgroundColor: colors.brand100,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  collectorRoleText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.brand800,
    letterSpacing: 0.5,
  },
  driverContact: {
    fontSize: 11,
    color: colors.neutral500,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: colors.neutral100,
    borderRadius: 10,
  },
  vehicleBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  vehicleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brand50 || "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  vehicleReg: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.neutral900,
  },
  vehicleType: {
    fontSize: 11,
    color: colors.neutral500,
    marginTop: 1,
  },
  activePill: {
    backgroundColor: colors.brand100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.brand700,
  },
  gpsBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  gpsBannerReady: {
    backgroundColor: colors.brand50 || "#ecfdf5",
    borderColor: colors.brand200 || "#a7f3d0",
  },
  gpsBannerWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  gpsBannerDisabled: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  gpsBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  gpsBannerSub: {
    fontSize: 10,
    marginTop: 1,
    lineHeight: 14,
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.neutral200,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral500,
  },
  tabButtonTextActive: {
    fontWeight: "800",
    color: colors.neutral900,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.neutral200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardActive: {
    borderColor: colors.brand600,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral400,
    marginRight: 6,
  },
  dotOnTheWay: {
    backgroundColor: "#3b82f6",
  },
  dotArrived: {
    backgroundColor: "#10b981",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.neutral800,
  },
  addressText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral900,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.neutral50,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: colors.neutral400,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral800,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: colors.neutral900,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnActive: {
    backgroundColor: colors.brand600,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtnTextActive: {
    color: colors.white,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.neutral200,
    opacity: 0.95,
  },
  historyCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand50 || "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand200 || "#a7f3d0",
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.brand700,
  },
  historyDate: {
    fontSize: 11,
    color: colors.neutral400,
  },
  historyAddress: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral800,
    marginBottom: 10,
  },
  historyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.neutral50,
    borderRadius: 8,
    padding: 8,
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral800,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12,
    color: colors.neutral500,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
});
