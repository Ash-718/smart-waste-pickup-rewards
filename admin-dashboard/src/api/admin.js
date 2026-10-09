import { apiFetch } from "../lib/apiClient";

export function getDashboardSummary() {
  return apiFetch("/admin/dashboard/summary");
}

export function getAnalyticsOverview(timeRange = "all") {
  return apiFetch(`/admin/analytics/overview?timeRange=${encodeURIComponent(timeRange)}`);
}

export function getAnalyticsMonthly(year, month) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (month) params.set("month", month);
  return apiFetch(`/admin/analytics/monthly?${params.toString()}`);
}

export function getAnalyticsTrends(months = 6) {
  return apiFetch(`/admin/analytics/trends?months=${months}`);
}

export function getAnalyticsWasteCategories() {
  return apiFetch("/admin/analytics/waste-category");
}

export function getAdminUsers() {
  return apiFetch("/admin/users");
}

export function getAdminUserProfile(id) {
  return apiFetch(`/admin/users/${id}`);
}

export function getAdminCollectors() {
  return apiFetch("/admin/collectors");
}

export function createAdminCollector(data) {
  return apiFetch("/admin/collectors", { method: "POST", body: data });
}

export function getRewards() {
  return apiFetch("/rewards");
}

export function createReward(data) {
  return apiFetch("/rewards", { method: "POST", body: data });
}

export function getBadges() {
  return apiFetch("/badges");
}

export function createBadge(data) {
  return apiFetch("/badges", { method: "POST", body: data });
}
