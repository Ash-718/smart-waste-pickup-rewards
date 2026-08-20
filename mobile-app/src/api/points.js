import { apiFetch } from "../lib/apiClient";

export function getBalance() {
  return apiFetch("/points/balance");
}

export function getHistory() {
  return apiFetch("/points/history");
}
