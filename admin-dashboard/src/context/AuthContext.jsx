import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { setAuthToken } from "../lib/apiClient";
import { login as loginRequest } from "../api/auth";

const AuthContext = createContext(null);

// Token lives only in memory (React state), never localStorage/sessionStorage,
// so a refresh logs the admin out rather than persisting a bearer token
// somewhere an XSS payload could read it.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle");

  const login = useCallback(async (credentials) => {
    setStatus("loading");
    try {
      const data = await loginRequest(credentials);
      if (data.user.role !== "admin") {
        setAuthToken(null);
        setStatus("idle");
        throw new Error("This account does not have admin access.");
      }
      setAuthToken(data.token);
      setUser(data.user);
      setStatus("idle");
      return data.user;
    } catch (err) {
      setStatus("idle");
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
