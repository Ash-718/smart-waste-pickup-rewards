import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as tokenStorage from "../lib/tokenStorage";
import { setAuthToken, setOnUnauthorized } from "../lib/apiClient";
import { login as loginRequest, register as registerRequest, me as meRequest } from "../api/auth";

const TOKEN_KEY = "wastewise_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  // "loading" while restoring a saved session on launch, then "idle".
  const [status, setStatus] = useState("loading");

  const logout = useCallback(async () => {
    await tokenStorage.deleteItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
  }, [logout]);

  useEffect(() => {
    (async () => {
      // Wrapped end-to-end (not just around the network call) so a
      // SecureStore failure can't leave `status` stuck at "loading" forever
      // — the splash gate in RootNavigator must always resolve.
      try {
        const token = await tokenStorage.getItem(TOKEN_KEY);
        if (!token) return;

        setAuthToken(token);
        try {
          const data = await meRequest();
          setUser(data.user);
        } catch {
          await tokenStorage.deleteItem(TOKEN_KEY);
          setAuthToken(null);
        }
      } catch (err) {
        console.warn("Session restore failed:", err.message);
      } finally {
        setStatus("idle");
      }
    })();
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await loginRequest(credentials);
    await tokenStorage.setItem(TOKEN_KEY, data.token);
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await registerRequest(payload);
    await tokenStorage.setItem(TOKEN_KEY, data.token);
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);


  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
