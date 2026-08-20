import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme/colors";

export default function TextField({ label, style, ...inputProps }) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.neutral400}
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: colors.neutral700,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.neutral200,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.neutral900,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
