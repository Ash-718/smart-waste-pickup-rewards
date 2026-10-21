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

export function updatePickupStatus(id, statusOrPayload) {
  const body = typeof statusOrPayload === "string" ? { status: statusOrPayload } : statusOrPayload;
  return apiFetch(`/pickups/${id}/status`, { method: "PATCH", body });
}

export function rejectPickup(id, payload = {}) {
  const body = typeof payload === "string" ? { rejectionReason: payload } : payload;
  return apiFetch(`/pickups/${id}/reject`, { method: "POST", body });
}
