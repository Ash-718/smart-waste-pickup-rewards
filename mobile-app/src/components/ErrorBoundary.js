import { Component } from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import { colors } from "../theme/colors";

// React error boundaries must be class components — there is no hook
// equivalent. Without this, an uncaught render error anywhere in the tree
// leaves the native shell showing whatever was on screen (often the splash
// spinner) with no indication anything went wrong.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Button title="Try again" onPress={() => this.setState({ error: null })} />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: colors.neutral900,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  message: {
    color: colors.neutral500,
    fontSize: 13,
    marginBottom: 20,
    textAlign: "center",
  },
});
