import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export default function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message || "Please try again."}</Text>
      {onRetry && (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.red50,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    color: colors.red700,
    fontSize: 14,
    fontWeight: "600",
  },
  message: {
    color: colors.red600,
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.red600,
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
});
