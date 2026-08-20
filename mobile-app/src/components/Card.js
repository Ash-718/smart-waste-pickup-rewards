import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.neutral200,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
});
