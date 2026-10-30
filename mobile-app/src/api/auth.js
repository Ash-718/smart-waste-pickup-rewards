import { apiFetch } from "../lib/apiClient";

export function register(payload) {
  return apiFetch("/auth/register", { method: "POST", body: payload });
}

export function login(credentials) {
  return apiFetch("/auth/login", { method: "POST", body: credentials });
}

export function me() {
  return apiFetch("/auth/me");
}

export function applyCollector(payload) {
  return apiFetch("/collector-applications/apply", { method: "POST", body: payload });
}

export function checkCollectorStatus(query) {
  return apiFetch(`/collector-applications/status?query=${encodeURIComponent(query)}`);
}
