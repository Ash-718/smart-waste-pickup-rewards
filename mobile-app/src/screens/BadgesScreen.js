import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import { listBadges } from "../api/badges";
import { colors } from "../theme/colors";

export default function BadgesScreen() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["badges"],
    queryFn: listBadges,
  });

  const badges = data?.badges || [];

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <Text style={styles.title}>Badges</Text>

      {isError && <ErrorState message={error.message} onRetry={refetch} />}

      {!isLoading &&
        !isError &&
        badges.map((badge) => (
          <Card key={badge.id} style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
            <View style={styles.row}>
              <View style={[styles.medal, !badge.earned && styles.medalLocked]}>
                <Text style={styles.medalText}>{badge.earned ? "🏅" : "🔒"}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, !badge.earned && styles.nameLocked]}>{badge.name}</Text>
                <Text style={styles.description}>
                  {badge.description || `Earn ${badge.minPoints}+ Green Points`}
                </Text>
                {badge.earned && badge.earnedAt && (
                  <Text style={styles.earnedAt}>
                    Earned {new Date(badge.earnedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        ))}
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
  badgeCard: {
    marginBottom: 10,
  },
  badgeCardLocked: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  medal: {
    alignItems: "center",
    backgroundColor: colors.brand100,
    borderRadius: 24,
    height: 44,
    justifyContent: "center",
    marginRight: 12,
    width: 44,
  },
  medalLocked: {
    backgroundColor: colors.neutral100,
  },
  medalText: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.neutral900,
    fontSize: 14,
    fontWeight: "700",
  },
  nameLocked: {
    color: colors.neutral600,
  },
  description: {
    color: colors.neutral500,
    fontSize: 12,
    marginTop: 2,
  },
  earnedAt: {
    color: colors.brand700,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
