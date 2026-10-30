const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  getCitizenReport,
  downloadCitizenPdf,
  downloadCitizenCsv,
  getAdminReport,
  downloadAdminPdf,
  downloadAdminCsv,
  downloadAdminExcel,
} = require("../controllers/reportController");

const router = express.Router();

// All report endpoints require authenticated session
router.use(requireAuth);

// Citizen Reports (Scoped strictly to the authenticated user derived from verified JWT)
router.get("/citizen", getCitizenReport);
router.get("/citizen/pdf", downloadCitizenPdf);
router.get("/citizen/csv", downloadCitizenCsv);

// Admin Platform Reports (Strictly restricted to admin role)
router.get("/admin", requireRole("admin"), getAdminReport);
router.get("/admin/pdf", requireRole("admin"), downloadAdminPdf);
router.get("/admin/csv", requireRole("admin"), downloadAdminCsv);
router.get("/admin/excel", requireRole("admin"), downloadAdminExcel);

module.exports = router;
