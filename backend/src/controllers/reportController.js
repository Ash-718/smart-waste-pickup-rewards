const { asyncHandler } = require("../middleware/errorHandler");
const { getCitizenReportData, getAdminReportData } = require("../services/reportService");
const {
  generateCitizenPdf,
  generateAdminPdf,
  generateCitizenCsv,
  generateAdminCsv,
  generateAdminExcel,
} = require("../services/reportExportService");

/**
 * GET /api/reports/citizen
 * Preview JSON data for the authenticated citizen.
 */
const getCitizenReport = asyncHandler(async (req, res) => {
  // Always derive citizen identity strictly from verified JWT
  const userId = req.user.id;
  const { period, startDate, endDate } = req.query;

  const data = await getCitizenReportData(userId, { period, startDate, endDate });
  res.json(data);
});

/**
 * GET /api/reports/citizen/pdf
 * Download citizen impact report as PDF.
 */
const downloadCitizenPdf = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { period, startDate, endDate } = req.query;

  const data = await getCitizenReportData(userId, { period, startDate, endDate });
  const pdfBuffer = await generateCitizenPdf(data);

  const filename = `WasteWise_Impact_Report_${(data.reportingPeriod.period || "custom")}_${new Date().toISOString().slice(0, 10)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.end(pdfBuffer);
});

/**
 * GET /api/reports/citizen/csv
 * Export citizen impact data as CSV.
 */
const downloadCitizenCsv = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { period, startDate, endDate } = req.query;

  const data = await getCitizenReportData(userId, { period, startDate, endDate });
  const csvString = generateCitizenCsv(data);

  const filename = `WasteWise_Impact_Data_${(data.reportingPeriod.period || "custom")}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvString);
});

/**
 * GET /api/reports/admin
 * Preview platform analytics report for administrators.
 */
const getAdminReport = asyncHandler(async (req, res) => {
  const { period, startDate, endDate, category } = req.query;
  const data = await getAdminReportData({ period, startDate, endDate, category });
  res.json(data);
});

/**
 * GET /api/reports/admin/pdf
 * Download platform executive report as PDF.
 */
const downloadAdminPdf = asyncHandler(async (req, res) => {
  const { period, startDate, endDate, category } = req.query;
  const data = await getAdminReportData({ period, startDate, endDate, category });
  const pdfBuffer = await generateAdminPdf(data);

  const filename = `WasteWise_Admin_Report_${(data.reportingPeriod.period || "custom")}_${new Date().toISOString().slice(0, 10)}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  res.end(pdfBuffer);
});

/**
 * GET /api/reports/admin/csv
 * Export platform analytics data as CSV.
 */
const downloadAdminCsv = asyncHandler(async (req, res) => {
  const { period, startDate, endDate, category } = req.query;
  const data = await getAdminReportData({ period, startDate, endDate, category });
  const csvString = generateAdminCsv(data);

  const filename = `WasteWise_Admin_Data_${(data.reportingPeriod.period || "custom")}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvString);
});

/**
 * GET /api/reports/admin/excel
 * Download comprehensive multi-worksheet Excel workbook.
 */
const downloadAdminExcel = asyncHandler(async (req, res) => {
  const { period, startDate, endDate, category } = req.query;
  const data = await getAdminReportData({ period, startDate, endDate, category });
  const excelBuffer = await generateAdminExcel(data);

  const filename = `WasteWise_Executive_Workbook_${(data.reportingPeriod.period || "custom")}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", excelBuffer.length);
  res.end(excelBuffer);
});

module.exports = {
  getCitizenReport,
  downloadCitizenPdf,
  downloadCitizenCsv,
  getAdminReport,
  downloadAdminPdf,
  downloadAdminCsv,
  downloadAdminExcel,
};
