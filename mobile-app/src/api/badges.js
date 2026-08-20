import { apiFetch } from "../lib/apiClient";

export function listBadges() {
  return apiFetch("/badges");
}
