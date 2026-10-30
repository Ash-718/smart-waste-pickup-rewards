import { apiFetch, getAuthToken, API_BASE_URL } from "../lib/apiClient";
import { Platform } from "react-native";

export function getCitizenReport(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);

  const qs = query.toString();
  return apiFetch(`/reports/citizen${qs ? `?${qs}` : ""}`);
}

export async function downloadCitizenReportFile(type = "pdf", params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);

  const qs = query.toString();
  const endpoint = `/reports/citizen/${type}${qs ? `?${qs}` : ""}`;
  const token = getAuthToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Download failed (${res.status})`);
  }

  const defaultFilename = `WasteWise_Citizen_Report.${type}`;
  const disposition = res.headers.get("content-disposition");
  let filename = defaultFilename;
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1];
  }

  if (Platform.OS === "web") {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  } else {
    // Native fallback
    const textOrBlob = await res.text();
    return textOrBlob;
  }
}
