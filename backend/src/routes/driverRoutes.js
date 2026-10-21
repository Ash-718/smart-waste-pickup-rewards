const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  getDriverPickups,
  updatePickupStatusByDriver,
} = require("../controllers/driverController");

const router = express.Router();

// Driver routes require authenticated collector/driver
router.use(requireAuth, requireRole("collector"));

// GET /api/driver/pickups - Driver's assigned jobs
router.get("/pickups", getDriverPickups);

// PATCH /api/driver/pickups/:id/status - Update trip status (start, arrived, complete)
router.patch("/pickups/:id/status", updatePickupStatusByDriver);

module.exports = router;
