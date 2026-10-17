import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

const STATUS_STEPS = [
  { key: "requested", label: "Request Booked", icon: "document-text-outline" },
  { key: "assigned", label: "Vehicle Assigned", icon: "cube-outline" },
  { key: "on_the_way", label: "On the Way", icon: "car-outline" },
  { key: "arrived", label: "Arrived at Location", icon: "location-outline" },
  { key: "completed", label: "Pickup Completed", icon: "checkmark-circle-outline" },
];

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function StatusStepper({ status, timestamps = {} }) {
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === status);
  const activeIndex = currentStepIndex !== -1 ? currentStepIndex : 0;

  return (
    <View style={styles.container}>
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = idx < activeIndex || status === "completed";
        const isCurrent = idx === activeIndex && status !== "completed";
        const isFuture = idx > activeIndex && status !== "completed";

        let timeStr = "";
        if (step.key === "requested" && timestamps.createdAt) {
          timeStr = formatTime(timestamps.createdAt);
        } else if (step.key === "assigned" && timestamps.assignedAt) {
          timeStr = formatTime(timestamps.assignedAt);
        } else if (step.key === "on_the_way" && timestamps.startedAt) {
          timeStr = formatTime(timestamps.startedAt);
        } else if (step.key === "arrived" && timestamps.arrivedAt) {
          timeStr = formatTime(timestamps.arrivedAt);
        } else if (step.key === "completed" && timestamps.completedAt) {
          timeStr = formatTime(timestamps.completedAt);
        }

        return (
          <View key={step.key} style={styles.stepRow}>
            {/* Timeline Column: Indicator + Connector Line */}
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.node,
                  isCompleted && styles.nodeCompleted,
                  isCurrent && styles.nodeCurrent,
                  isFuture && styles.nodeFuture,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={13} color={colors.white} />
                ) : (
                  <View
                    style={[
                      styles.dot,
                      isCurrent && styles.dotCurrent,
                      isFuture && styles.dotFuture,
                    ]}
                  />
                )}
              </View>

              {idx < STATUS_STEPS.length - 1 && (
                <View
                  style={[
                    styles.connector,
                    (isCompleted || isCurrent) && styles.connectorActive,
                  ]}
                />
              )}
            </View>

            {/* Label and Timestamp Column */}
            <View style={styles.contentCol}>
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.label,
                    isCurrent && styles.labelCurrent,
                    isCompleted && styles.labelCompleted,
                    isFuture && styles.labelFuture,
                  ]}
                >
                  {step.label}
                </Text>
                {timeStr ? <Text style={styles.timestamp}>{timeStr}</Text> : null}
              </View>
              {isCurrent ? (
                <Text style={styles.activeSubtext}>
                  {step.key === "assigned" && "Your collector is preparing the vehicle"}
                  {step.key === "on_the_way" && "Driver is en route to your address"}
                  {step.key === "arrived" && "Driver has reached your pickup spot"}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  stepRow: {
    flexDirection: "row",
    minHeight: 46,
  },
  indicatorCol: {
    alignItems: "center",
    width: 28,
  },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral100,
    borderWidth: 2,
    borderColor: colors.neutral300,
    zIndex: 2,
  },
  nodeCompleted: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand600,
  },
  nodeCurrent: {
    backgroundColor: colors.brand50,
    borderColor: colors.brand600,
  },
  nodeFuture: {
    backgroundColor: colors.neutral100,
    borderColor: colors.neutral200,
  },
  checkmarkText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotCurrent: {
    backgroundColor: colors.brand600,
  },
  dotFuture: {
    backgroundColor: colors.neutral300,
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: colors.neutral200,
    marginVertical: 2,
  },
  connectorActive: {
    backgroundColor: colors.brand600,
  },
  contentCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    justifyContent: "flex-start",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    color: colors.neutral800,
  },
  labelCompleted: {
    color: colors.neutral900,
    fontWeight: "600",
  },
  labelCurrent: {
    color: colors.brand700,
    fontWeight: "700",
  },
  labelFuture: {
    color: colors.neutral400,
  },
  timestamp: {
    fontSize: 12,
    color: colors.neutral500,
    fontWeight: "500",
  },
  activeSubtext: {
    fontSize: 12,
    color: colors.brand600,
    marginTop: 2,
  },
});
