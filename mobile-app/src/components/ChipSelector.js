import { StyleSheet, Text, View, Pressable } from "react-native";
import { colors } from "../theme/colors";

export default function ChipSelector({ label, options, value, onChange }) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderColor: colors.neutral200,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.brand600,
    borderColor: colors.brand600,
  },
  chipText: {
    color: colors.neutral700,
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: colors.white,
  },
});
