import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";

import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { colors } from "./src/theme/colors";
import { API_BASE_URL, SOCKET_BASE_URL } from "./src/lib/apiClient";

// Prevent splash screen from auto-hiding until assets are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const loadFonts = useCallback(async () => {
    try {
      setFontError(null);
      // Preload Ionicons font explicitly
      await Font.loadAsync(Ionicons.font);
      setFontsLoaded(true);
    } catch (err) {
      console.warn("[App] Font preloading error:", err);
      setFontError(err);
    } finally {
      await SplashScreen.hideAsync().catch(() => {});
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    loadFonts();
  }, [loadFonts]);

  // If font loading failed, show a retry screen instead of crashing
  if (fontError && !fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <View style={styles.warningDot} />
            <Text style={styles.errorTitle}>Unable to Load Assets</Text>
            <Text style={styles.errorMessage}>
              Could not load icon fonts from Metro bundler.
            </Text>
            <Text style={styles.errorDetail}>
              {fontError?.message || "Connection timeout downloading assets"}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setRetrying(true);
                loadFonts();
              }}
              disabled={retrying}
            >
              {retrying ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.retryButtonText}>Retry Loading Fonts</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Still waiting on splash screen
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
            <StatusBar style="dark" />

            {/* Dev-Only Debug Banner: renders strictly when __DEV__ is true */}
            {__DEV__ && (
              <View style={styles.devDebugBar} pointerEvents="none">
                <Text style={styles.devDebugText} numberOfLines={1}>
                  [DEV] API: {API_BASE_URL} | Socket: {SOCKET_BASE_URL}
                </Text>
              </View>
            )}
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  warningDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.amber600,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.neutral900,
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    color: colors.neutral600,
    textAlign: "center",
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 11,
    color: colors.neutral400,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  retryButton: {
    backgroundColor: colors.brand600,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  devDebugBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  devDebugText: {
    color: "#94A3B8",
    fontSize: 9,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.2,
  },
});
