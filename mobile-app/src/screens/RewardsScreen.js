import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { listRewards, redeemReward } from "../api/rewards";
import { getBalance } from "../api/points";
import { colors } from "../theme/colors";

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
        "Reward redeemed!",
        `Your redemption code is ${data.redemption.redemptionCode}. Show this to a program coordinator to collect it.`
      );
    },
    onError: (err) => Alert.alert("Couldn't redeem reward", err.message),
    onSettled: () => setRedeemingId(null),
  });

  const balance = balanceQuery.data?.balance ?? 0;
  const rewards = rewardsQuery.data?.rewards || [];

  return (
    <Screen onRefresh={rewardsQuery.refetch} refreshing={rewardsQuery.isFetching}>
      <Text style={styles.title}>Rewards</Text>
      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        <Text style={styles.balanceValue}>{balance} pts</Text>
      </Card>

      {rewardsQuery.isError && (
        <ErrorState message={rewardsQuery.error.message} onRetry={rewardsQuery.refetch} />
      )}

      {!rewardsQuery.isError && rewards.length === 0 && (
        <EmptyState title="No rewards available right now" />
      )}

      {rewards.map((reward) => {
        const affordable = balance >= reward.pointsRequired;
        const inStock = reward.stock > 0;
        return (
          <Card key={reward.id} style={styles.rewardCard}>
            <View style={styles.rewardRow}>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardName}>{reward.name}</Text>
                {reward.description && (
                  <Text style={styles.rewardDescription}>{reward.description}</Text>
                )}
                <Text style={styles.rewardPoints}>{reward.pointsRequired} pts</Text>
              </View>
              <Button
                title={inStock ? "Redeem" : "Out of stock"}
                variant="outline"
                disabled={!affordable || !inStock || redeemMutation.isPending}
                loading={redeemingId === reward.id && redeemMutation.isPending}
                onPress={() => redeemMutation.mutate(reward.id)}
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.neutral900,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  balanceCard: {
    marginBottom: 16,
  },
  balanceLabel: {
    color: colors.neutral500,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  balanceValue: {
    color: colors.brand700,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 4,
  },
  rewardCard: {
    marginBottom: 10,
  },
  rewardRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rewardInfo: {
    flex: 1,
    marginRight: 12,
  },
  rewardName: {
    color: colors.neutral900,
    fontSize: 14,
    fontWeight: "600",
  },
  rewardDescription: {
    color: colors.neutral500,
    fontSize: 12,
    marginTop: 2,
  },
  rewardPoints: {
    color: colors.brand700,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
});
