import { apiFetch } from "../lib/apiClient";

export function login(credentials) {
  return apiFetch("/auth/login", { method: "POST", body: credentials });
}

export function me() {
  return apiFetch("/auth/me");
}
