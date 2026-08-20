import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store has no real native module backing it on web — calling
// setItemAsync/getItemAsync there throws
// "ExpoSecureStore.default.setValueWithKeyAsync is not a function" instead
// of storing anything. Native keeps the OS keychain/keystore; web falls
// back to localStorage, wrapped in the same async interface so callers
// don't need to know which platform they're on.
const isWeb = Platform.OS === "web";

async function getItem(key) {
  if (isWeb) return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key, value) {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

async function deleteItem(key) {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  return SecureStore.deleteItemAsync(key);
}

export { getItem, setItem, deleteItem };
