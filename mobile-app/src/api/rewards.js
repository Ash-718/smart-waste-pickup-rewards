import { apiFetch } from "../lib/apiClient";

export function listRewards() {
  return apiFetch("/rewards");
}

export function redeemReward(id) {
  return apiFetch(`/rewards/${id}/redeem`, { method: "POST" });
}
