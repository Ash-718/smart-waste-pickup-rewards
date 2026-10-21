import { apiFetch } from "../lib/apiClient";

/**
 * Fetch all assigned active pickups for the authenticated driver/collector
 */
export function listDriverPickups() {
  return apiFetch("/driver/pickups");
}

/**
 * Update the status of an assigned pickup (on_the_way, arrived, completed)
 *
 * @param {string} pickupId
 * @param {object} payload - { status: 'on_the_way' | 'arrived' | 'completed', wasteQuantity?: number }
 */
export function updateDriverPickupStatus(pickupId, payload) {
  return apiFetch(`/driver/pickups/${pickupId}/status`, {
    method: "PATCH",
    body: payload,
  });
}
