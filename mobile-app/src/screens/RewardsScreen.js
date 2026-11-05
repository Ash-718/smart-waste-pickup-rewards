import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { listRewards, redeemReward } from "../api/rewards";
import { getBalance } from "../api/points";
import { colors } from "../theme/colors";

// Map reward name to appropriate vector category icon and accent
function getRewardIcon(name = "") {
  const lower = name.toLowerCase();
  if (lower.includes("plant") || lower.includes("tree") || lower.includes("sapling") || lower.includes("seed")) {
    return { name: "leaf", color: "#16a34a", bg: "#dcfce7" };
  }
  if (lower.includes("bag") || lower.includes("tote") || lower.includes("backpack")) {
    return { name: "bag-handle", color: "#0284c7", bg: "#e0f2fe" };
  }
  if (lower.includes("transit") || lower.includes("pass") || lower.includes("bus") || lower.includes("metro")) {
    return { name: "bus", color: "#9333ea", bg: "#f3e8ff" };
  }
  if (lower.includes("coupon") || lower.includes("voucher") || lower.includes("discount")) {
    return { name: "pricetag", color: "#ea580c", bg: "#ffedd5" };
  }
  if (lower.includes("bottle") || lower.includes("mug") || lower.includes("cup")) {
    return { name: "water", color: "#0891b2", bg: "#cffafe" };
  }
  return { name: "gift", color: "#059669", bg: "#d1fae5" };
}

export default function RewardsScreen() {
  const queryClient = useQueryClient();
  const [redeemingId, setRedeemingId] = useState(null);

  const balanceQuery = useQuery({ queryKey: ["points-balance"], queryFn: getBalance });
  const rewardsQuery = useQuery({ queryKey: ["rewards"], queryFn: listRewards });

  const redeemMutation = useMutation({
    mutationFn: redeemReward,
    onMutate: (id) => setRedeemingId(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["points-balance"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      Alert.alert(
        "Reward Redeemed!",
        `Your redemption code is: ${data.redemption.redemptionCode}\n\nShow this code to any pickup driver or foundation coordinator to claim your reward.`
      );
    },
    onError: (err) => Alert.alert("Couldn't redeem reward", err.message),
    onSettled: () => setRedeemingId(null),
  });

  const balance = balanceQuery.data?.balance ?? 0;
  const rewards = rewardsQuery.data?.rewards || [];

  const handleRefresh = () => {
    balanceQuery.refetch();
    rewardsQuery.refetch();
  };

  const isRefreshing = balanceQuery.isFetching || rewardsQuery.isFetching;

  return (
    <Screen onRefresh={handleRefresh} refreshing={isRefreshing}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Rewards Catalog</Text>
        <Text style={styles.subtitle}>Redeem your Green Points for eco-friendly goods & vouchers</Text>
      </View>

      {/* Eco Wallet Hero Card */}
      <Card style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View style={styles.walletTag}>
            <Ionicons name="wallet" size={13} color="#a7f3d0" style={{ marginRight: 5 }} />
            <Text style={styles.walletTagText}>ECO REWARDS WALLET</Text>
          </View>
          <View style={styles.walletGoldChip}>
            <Ionicons name="sparkles" size={12} color="#fde047" style={{ marginRight: 4 }} />
            <Text style={styles.walletGoldText}>Active</Text>
          </View>
        </View>

        <View style={styles.balanceContainer}>
          <Text style={styles.balanceNumber}>{balance}</Text>
          <View style={styles.balancePointsLabelWrap}>
            <Text style={styles.balancePointsUnit}>GREEN POINTS</Text>
            <Text style={styles.balanceSubtitle}>Available to spend</Text>
          </View>
        </View>

        <View style={styles.walletFooter}>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={13} color="#34d399" style={{ marginRight: 4 }} />
            <Text style={styles.perkText}>Instant redemption</Text>
          </View>
          <View style={styles.perkDivider} />
          <View style={styles.perkItem}>
            <Ionicons name="shield-checkmark" size={13} color="#34d399" style={{ marginRight: 4 }} />
            <Text style={styles.perkText}>Points never expire</Text>
          </View>
        </View>
      </Card>

      {rewardsQuery.isError && (
        <ErrorState message={rewardsQuery.error.message} onRetry={handleRefresh} />
      )}

      {!rewardsQuery.isError && rewards.length === 0 && (
        <EmptyState title="No rewards available right now" description="Check back soon for new partner perks and eco goods." />
      )}

      {/* Rewards List */}
      {rewards.map((reward) => {
        const affordable = balance >= reward.pointsRequired;
        const inStock = reward.stock > 0;
        const iconConfig = getRewardIcon(reward.name);
        const pointsShortage = Math.max(0, reward.pointsRequired - balance);

        return (
          <Card key={reward.id} style={styles.rewardCard}>
            <View style={styles.rewardRow}>
              {/* Category Icon */}
              <View style={[styles.rewardIconWrap, { backgroundColor: iconConfig.bg }]}>
                <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
              </View>

              {/* Reward Details */}
              <View style={styles.rewardInfo}>
                <View style={styles.nameAndStockRow}>
                  <Text style={styles.rewardName} numberOfLines={1}>
                    {reward.name}
                  </Text>
                  {inStock ? (
                    <View style={styles.stockPill}>
                      <Text style={styles.stockText}>{reward.stock} in stock</Text>
                    </View>
                  ) : (
                    <View style={styles.outOfStockPill}>
                      <Text style={styles.outOfStockText}>Out of stock</Text>
                    </View>
                  )}
                </View>

                {reward.description && (
                  <Text style={styles.rewardDescription} numberOfLines={2}>
                    {reward.description}
                  </Text>
                )}

                {/* Price and Action Row */}
                <View style={styles.bottomActionRow}>
                  <View style={styles.costBadge}>
                    <Ionicons name="sparkles" size={12} color="#d97706" style={{ marginRight: 4 }} />
                    <Text style={styles.costBadgeText}>{reward.pointsRequired} pts</Text>
                  </View>

                  <Button
                    title={
                      !inStock
                        ? "Out of stock"
                        : !affordable
                        ? `Need ${pointsShortage} pts`
                        : "Redeem"
                    }
                    variant={affordable && inStock ? "primary" : "outline"}
                    disabled={!affordable || !inStock || redeemMutation.isPending}
                    loading={redeemingId === reward.id && redeemMutation.isPending}
                    onPress={() => redeemMutation.mutate(reward.id)}
                    style={styles.redeemButton}
                  />
                </View>
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 14,
  },
  title: {
    color: colors.neutral900,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 2,
  },
  walletCard: {
    backgroundColor: "#064e3b", // Forest Emerald
    borderColor: "#047857",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#064e3b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  walletTag: {
    flexDirection: "row",
    alignItems: "center",
  },
  walletTagText: {
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  walletGoldChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  walletGoldText: {
    color: "#fef08a",
    fontSize: 11,
    fontWeight: "700",
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  balanceNumber: {
    color: colors.white,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1,
    marginRight: 10,
  },
  balancePointsLabelWrap: {
    justifyContent: "center",
  },
  balancePointsUnit: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  balanceSubtitle: {
    color: "#a7f3d0",
    fontSize: 11,
    marginTop: 1,
  },
  walletFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    paddingTop: 10,
  },
  perkItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  perkText: {
    color: "#d1fae5",
    fontSize: 11,
    fontWeight: "500",
  },
  perkDivider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 12,
  },
  rewardCard: {
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.neutral200,
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rewardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  rewardInfo: {
    flex: 1,
  },
  nameAndStockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  rewardName: {
    color: colors.neutral900,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  stockPill: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stockText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "600",
  },
  outOfStockPill: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  outOfStockText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },
  rewardDescription: {
    color: colors.neutral500,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 10,
  },
  bottomActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  costBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  costBadgeText: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "700",
  },
  redeemButton: {
    minWidth: 90,
  },
});
