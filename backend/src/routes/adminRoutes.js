const express = require("express");
const { summary } = require("../controllers/adminController");
const {
  getOverview,
  getMonthly,
  getTrends,
  getWasteCategories,
} = require("../controllers/analyticsController");
const {
  listUsers,
  getUserProfile,
  listCollectors,
  createCollector,
} = require("../controllers/userManagementController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

// Preserved existing summary endpoint
router.get("/dashboard/summary", summary);

// Analytics endpoints
router.get("/analytics/overview", getOverview);
router.get("/analytics/monthly", getMonthly);
router.get("/analytics/trends", getTrends);
router.get("/analytics/waste-category", getWasteCategories);

// User contribution & management
router.get("/users", listUsers);
router.get("/users/:id", getUserProfile);

// Collector / Staff management
router.get("/collectors", listCollectors);
router.post("/collectors", createCollector);

module.exports = router;
