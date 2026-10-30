import { apiFetch, downloadFile } from "../lib/apiClient";

export function getAdminReports(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.category && params.category !== "all") query.set("category", params.category);

  const qs = query.toString();
  return apiFetch(`/reports/admin${qs ? `?${qs}` : ""}`);
}

export function downloadAdminPdfReport(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.category && params.category !== "all") query.set("category", params.category);

  const qs = query.toString();
  return downloadFile(`/reports/admin/pdf${qs ? `?${qs}` : ""}`, "WasteWise_Admin_Report.pdf");
}

export function downloadAdminCsvReport(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.category && params.category !== "all") query.set("category", params.category);

  const qs = query.toString();
  return downloadFile(`/reports/admin/csv${qs ? `?${qs}` : ""}`, "WasteWise_Admin_Report.csv");
}

export function downloadAdminExcelReport(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.set("period", params.period);
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.category && params.category !== "all") query.set("category", params.category);

  const qs = query.toString();
  return downloadFile(`/reports/admin/excel${qs ? `?${qs}` : ""}`, "WasteWise_Admin_Report.xlsx");
}
