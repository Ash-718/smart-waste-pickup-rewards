import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../components/Screen";
import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import { listBadges } from "../api/badges";
import { getBalance } from "../api/points";
import { colors } from "../theme/colors";

// Classify badge tier and assign distinctive vector icons & metallic color palettes
function getBadgeTier(badge) {
  const name = (badge.name || "").toLowerCase();
  const minPoints = badge.minPoints || 0;

  if (name.includes("champion") || name.includes("platinum") || name.includes("diamond") || minPoints >= 200) {
    return {
      tierName: "Diamond Tier",
      badgeType: "diamond",
      iconName: "sparkles",
      primaryColor: "#0284c7", // Cyan 600
      secondaryColor: "#e0f2fe", // Cyan 100
      borderColor: "#7dd3fc", // Cyan 300
      cardBorder: "#bae6fd",
    };
  }
  if (name.includes("gold") || minPoints >= 75) {
    return {
      tierName: "Gold Tier",
      badgeType: "gold",
      iconName: "trophy",
      primaryColor: "#d97706", // Amber 600 / Gold
      secondaryColor: "#fef3c7", // Amber 100
      borderColor: "#fcd34d", // Amber 300
      cardBorder: "#fde68a",
    };
  }
  if (name.includes("silver") || minPoints >= 25) {
    return {
      tierName: "Silver Tier",
      badgeType: "silver",
      iconName: "shield-checkmark",
      primaryColor: "#475569", // Slate 600
      secondaryColor: "#f1f5f9", // Slate 100
      borderColor: "#cbd5e1", // Slate 300
      cardBorder: "#e2e8f0",
    };
  }
  return {
    tierName: "Bronze Tier",
    badgeType: "bronze",
    iconName: "ribbon",
    primaryColor: "#c2410c", // Warm Orange / Bronze
    secondaryColor: "#ffedd5", // Bronze 100
    borderColor: "#fed7aa", // Bronze 300
    cardBorder: "#ffedd5",
  };
}

export default function BadgesScreen() {
  const { data: badgesData, isLoading: badgesLoading, isError: badgesError, error, refetch: refetchBadges, isFetching: badgesFetching } = useQuery({
    queryKey: ["badges"],
    queryFn: listBadges,
  });

  const { data: balanceData, refetch: refetchBalance, isFetching: balanceFetching } = useQuery({
    queryKey: ["points-balance"],
    queryFn: getBalance,
  });

  const badges = useMemo(() => badgesData?.badges || [], [badgesData]);
  const userPoints = balanceData?.balance ?? 0;

  const earnedCount = useMemo(() => badges.filter((b) => b.earned).length, [badges]);
  const totalCount = badges.length;
  const progressPercent = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  // Find the highest earned badge for the hero showcase
  const highestEarnedBadge = useMemo(() => {
    const earnedBadges = badges.filter((b) => b.earned);
    if (earnedBadges.length === 0) return null;
    return earnedBadges.reduce((prev, curr) => ((curr.minPoints || 0) > (prev.minPoints || 0) ? curr : prev));
  }, [badges]);

  const handleRefresh = () => {
    refetchBadges();
    refetchBalance();
  };

  const isRefreshing = badgesFetching || balanceFetching;

  return (
    <Screen onRefresh={handleRefresh} refreshing={isRefreshing}>
      {/* Screen Title */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Achievements & Badges</Text>
          <Text style={styles.subtitle}>Unlock tiers by scheduling pickups and recycling waste</Text>
        </View>
      </View>

      {/* Hero Achievement Showcase Card */}
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroMedalWrap}>
            <View style={styles.heroMedalOuter}>
              <Ionicons name="trophy" size={28} color="#f59e0b" />
            </View>
          </View>
          <View style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              <Text style={styles.heroBadgeLabel}>
                {highestEarnedBadge ? highestEarnedBadge.name : "Eco Recycler"}
              </Text>
              <View style={styles.heroPointsChip}>
                <Ionicons name="sparkles" size={11} color="#fde047" style={{ marginRight: 3 }} />
                <Text style={styles.heroPointsText}>{userPoints} pts</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>
              {earnedCount} of {totalCount} Badges Unlocked
            </Text>
            <View style={styles.heroProgressTrack}>
              <View style={[styles.heroProgressFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.heroHint}>
              {progressPercent === 100
                ? "All milestone badges achieved! Master recycler."
                : `${totalCount - earnedCount} more badges to unlock. Keep recycling!`}
            </Text>
          </View>
        </View>
      </Card>

      {badgesError && <ErrorState message={error?.message || "Failed to load badges"} onRetry={handleRefresh} />}

      {/* Badges List */}
      {!badgesLoading &&
        !badgesError &&
        badges.map((badge) => {
          const tier = getBadgeTier(badge);
          const pointsNeeded = badge.minPoints || 0;
          const pointsRemaining = Math.max(0, pointsNeeded - userPoints);
          const badgeProgress = pointsNeeded > 0 ? Math.min(100, Math.round((userPoints / pointsNeeded) * 100)) : 100;

          return (
            <Card
              key={badge.id}
              style={[
                styles.badgeCard,
                badge.earned
                  ? { borderColor: tier.cardBorder, borderLeftWidth: 4, borderLeftColor: tier.primaryColor }
                  : styles.badgeCardLocked,
              ]}
            >
              <View style={styles.badgeTopRow}>
                {/* Bespoke Tier Medal */}
                <View
                  style={[
                    styles.medalContainer,
                    badge.earned
                      ? { backgroundColor: tier.secondaryColor, borderColor: tier.borderColor }
                      : styles.medalContainerLocked,
                  ]}
                >
                  <Ionicons
                    name={badge.earned ? tier.iconName : "lock-closed"}
                    size={22}
                    color={badge.earned ? tier.primaryColor : "#94a3b8"}
                  />
                </View>

                {/* Badge Info */}
                <View style={styles.badgeInfo}>
                  <View style={styles.badgeTitleRow}>
                    <Text style={[styles.badgeName, !badge.earned && styles.badgeNameLocked]}>
                      {badge.name}
                    </Text>

                    {/* Status / Tier Tag */}
                    {badge.earned ? (
                      <View style={styles.unlockedTag}>
                        <Ionicons name="checkmark-circle" size={12} color="#15803d" style={{ marginRight: 3 }} />
                        <Text style={styles.unlockedTagText}>UNLOCKED</Text>
                      </View>
                    ) : (
                      <View style={styles.lockedTag}>
                        <Ionicons name="lock-closed" size={10} color="#64748b" style={{ marginRight: 3 }} />
                        <Text style={styles.lockedTagText}>{badge.minPoints} PTS</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.badgeDescription}>
                    {badge.description || `Awarded for achieving ${badge.minPoints}+ verified Green Points.`}
                  </Text>

                  {/* If Earned: Date */}
                  {badge.earned && badge.earnedAt && (
                    <View style={styles.earnedAtRow}>
                      <Ionicons name="ribbon-outline" size={12} color={tier.primaryColor} style={{ marginRight: 4 }} />
                      <Text style={[styles.earnedAtText, { color: tier.primaryColor }]}>
                        {tier.tierName} • Unlocked {new Date(badge.earnedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}

                  {/* If Locked: Progress Towards Badge */}
                  {!badge.earned && (
                    <View style={styles.lockedProgressBox}>
                      <View style={styles.lockedProgressHeader}>
                        <Text style={styles.lockedProgressLabel}>
                          Progress: {userPoints} / {badge.minPoints} pts
                        </Text>
                        <Text style={styles.lockedProgressPercent}>{badgeProgress}%</Text>
                      </View>
                      <View style={styles.lockedTrack}>
                        <View style={[styles.lockedFill, { width: `${badgeProgress}%`, backgroundColor: tier.primaryColor }]} />
                      </View>
                      <Text style={styles.lockedHelperText}>
                        Earn {pointsRemaining} more pts to unlock this badge!
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          );
        })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
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
  heroCard: {
    backgroundColor: "#064e3b", // Deep emerald forest
    borderColor: "#047857",
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroMedalWrap: {
    marginRight: 14,
  },
  heroMedalOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(245, 158, 11, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    flex: 1,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  heroBadgeLabel: {
    color: "#a7f3d0",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroPointsChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  heroPointsText: {
    color: "#fef08a",
    fontSize: 11,
    fontWeight: "700",
  },
  heroTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroProgressTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 999,
    height: 6,
    overflow: "hidden",
    width: "100%",
  },
  heroProgressFill: {
    backgroundColor: "#34d399", // Emerald bright fill
    borderRadius: 999,
    height: "100%",
  },
  heroHint: {
    color: "#d1fae5",
    fontSize: 11,
    marginTop: 6,
  },
  badgeCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeCardLocked: {
    backgroundColor: "#fafafa",
    borderColor: colors.neutral200,
    opacity: 0.88,
  },
  badgeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  medalContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    marginRight: 14,
    marginTop: 2,
  },
  medalContainerLocked: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  badgeInfo: {
    flex: 1,
  },
  badgeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  badgeName: {
    color: colors.neutral900,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    flex: 1,
  },
  badgeNameLocked: {
    color: colors.neutral700,
  },
  unlockedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unlockedTagText: {
    color: "#15803d",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  lockedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  lockedTagText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  badgeDescription: {
    color: colors.neutral500,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  earnedAtRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  earnedAtText: {
    fontSize: 11,
    fontWeight: "600",
  },
  lockedProgressBox: {
    marginTop: 8,
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  lockedProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  lockedProgressLabel: {
    color: colors.neutral600,
    fontSize: 11,
    fontWeight: "600",
  },
  lockedProgressPercent: {
    color: colors.neutral700,
    fontSize: 11,
    fontWeight: "700",
  },
  lockedTrack: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    height: 5,
    overflow: "hidden",
    width: "100%",
  },
  lockedFill: {
    borderRadius: 999,
    height: "100%",
  },
  lockedHelperText: {
    color: colors.neutral500,
    fontSize: 10,
    marginTop: 4,
  },
});
