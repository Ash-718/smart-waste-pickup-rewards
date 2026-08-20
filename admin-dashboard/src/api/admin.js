import { apiFetch } from "../lib/apiClient";

export function getDashboardSummary() {
  return apiFetch("/admin/dashboard/summary");
}
