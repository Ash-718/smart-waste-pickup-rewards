import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export default function EmptyState({ title, description }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderColor: colors.neutral200,
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    color: colors.neutral900,
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
});
