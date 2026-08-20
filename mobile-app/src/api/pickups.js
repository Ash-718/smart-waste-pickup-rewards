import { apiFetch } from "../lib/apiClient";

export function listPickups(status) {
  const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/pickups${query}`);
}

export function getPickup(id) {
  return apiFetch(`/pickups/${id}`);
}

export function createPickup(payload) {
  return apiFetch("/pickups", { method: "POST", body: payload });
}
