import { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { listDriverPickups } from "../api/driver";
import { colors } from "../theme/colors";

export default function DriverHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const isFocused = useIsFocused();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["driverPickups"],
    queryFn: listDriverPickups,
    refetchInterval: isFocused ? 10000 : false, // Pause 10s polling when screen is not focused
  });

  const pickups = data?.pickups || [];
  const vehicle = data?.vehicle;

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
              {item.status === "on_the_way" && "Trip in Progress"}
              {item.status === "arrived" && "Arrived at Customer"}
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

        <View style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>
            {item.status === "assigned" ? "Open Job & Start Trip →" : "Continue Active Job →"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Driver Header */}
      <View style={styles.header}>
        <View style={styles.driverProfile}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={colors.brand700} />
          </View>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.driverName}>{user?.name || "Fleet Collector"}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="log-out-outline" size={22} color={colors.neutral600} />
        </TouchableOpacity>
      </View>

      {/* Vehicle Status Banner */}
      <View style={styles.vehicleBanner}>
        <View style={styles.vehicleInfo}>
          <Ionicons name="car-sport" size={22} color={colors.brand600} style={{ marginRight: 10 }} />
          <View>
            <Text style={styles.vehicleReg}>{vehicle?.registrationNo || "Vehicle Unassigned"}</Text>
            <Text style={styles.vehicleType}>
              {vehicle ? `${vehicle.type} (${vehicle.capacity} kg capacity)` : "Contact Admin to assign vehicle"}
            </Text>
          </View>
        </View>
        {vehicle && (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>Ready</Text>
          </View>
        )}
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Assigned Pickups ({pickups.length})</Text>
        <Text style={styles.sectionSub}>Tap to open navigation and update status</Text>
      </View>

      {/* Pickups List with Pull to Refresh */}
      <FlatList
        data={pickups}
        keyExtractor={(item) => item.id}
        renderItem={renderPickupCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[colors.brand600]} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.brand600} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySub}>
                There are no active pickups assigned to your vehicle right now. New assignments will appear here automatically.
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
    borderRadius: 22,
    backgroundColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  greeting: {
    fontSize: 12,
    color: colors.neutral500,
    fontWeight: "500",
  },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.neutral900,
  },
  logoutBtn: {
    padding: 8,
  },
  vehicleBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  vehicleReg: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.neutral900,
  },
  vehicleType: {
    fontSize: 12,
    color: colors.neutral500,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: colors.brand100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand700,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.neutral900,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.neutral500,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.neutral200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    borderColor: colors.brand600,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber500,
    marginRight: 6,
  },
  dotOnTheWay: {
    backgroundColor: colors.blue600,
  },
  dotArrived: {
    backgroundColor: colors.brand600,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.neutral700,
  },
  addressText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.neutral900,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    backgroundColor: colors.neutral50,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.neutral500,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral800,
  },
  actionBtn: {
    backgroundColor: colors.brand50,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnText: {
    color: colors.brand700,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.neutral900,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: colors.neutral500,
    textAlign: "center",
    lineHeight: 18,
  },
});
