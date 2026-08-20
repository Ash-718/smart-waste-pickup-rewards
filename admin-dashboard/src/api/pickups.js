import { apiFetch } from "../lib/apiClient";

export function listPickups(status) {
  const query = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/pickups${query}`);
}

export function getPickup(id) {
  return apiFetch(`/pickups/${id}`);
}

export function assignPickup(id, payload = {}) {
  return apiFetch(`/pickups/${id}/assign`, { method: "PATCH", body: payload });
}

export function updatePickupStatus(id, status) {
  return apiFetch(`/pickups/${id}/status`, { method: "PATCH", body: { status } });
}
