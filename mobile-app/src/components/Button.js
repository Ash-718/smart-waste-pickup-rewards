import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

const VARIANTS = {
  primary: { bg: colors.brand600, text: colors.white, border: "transparent" },
  outline: { bg: "transparent", text: colors.neutral700, border: colors.neutral300 },
  danger: { bg: "transparent", text: colors.red600, border: colors.red600 },
};

export default function Button({
  title,
  label,
  children,
  icon,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  textStyle,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const displayText =
    title ||
    label ||
    (typeof children === "string" ? children : null) ||
    "Action";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        style,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <View style={styles.iconWrapper}>{icon}</View> : null}
          <Text style={[styles.text, { color: v.text }, textStyle]}>
            {displayText}
          </Text>
        </View>
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
    paddingHorizontal: 16,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    marginRight: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
});
