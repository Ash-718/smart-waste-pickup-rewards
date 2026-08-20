import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors";

const VARIANTS = {
  primary: { bg: colors.brand600, text: colors.white, border: "transparent" },
  outline: { bg: "transparent", text: colors.neutral700, border: colors.neutral300 },
  danger: { bg: "transparent", text: colors.red600, border: colors.red600 },
};

export default function Button({ title, onPress, variant = "primary", disabled, loading }) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.text, { color: v.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    paddingVertical: 14,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
});
