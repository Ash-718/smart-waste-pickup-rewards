import { apiFetch } from "../lib/apiClient";

export function getCollectorApplications({ status = "all", search = "" } = {}) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  return apiFetch(`/admin/collector-applications${qs ? `?${qs}` : ""}`);
}

export function getCollectorApplication(id) {
  return apiFetch(`/admin/collector-applications/${id}`);
}

export function approveCollectorApplication(id, vehicleId) {
  return apiFetch(`/admin/collector-applications/${id}/approve`, {
    method: "POST",
    body: { vehicleId: vehicleId || undefined },
  });
}

export function rejectCollectorApplication(id, reason) {
  return apiFetch(`/admin/collector-applications/${id}/reject`, {
    method: "POST",
    body: { reason },
  });
}
