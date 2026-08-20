import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

const STYLES = {
  requested: { bg: colors.amber50, text: colors.amber700 },
  assigned: { bg: colors.blue50, text: colors.blue700 },
  completed: { bg: colors.brand100, text: colors.brand800 },
  cancelled: { bg: colors.neutral100, text: colors.neutral600 },
};

const LABELS = {
  requested: "Requested",
  assigned: "Assigned",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.requested;
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>{LABELS[status] || status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
