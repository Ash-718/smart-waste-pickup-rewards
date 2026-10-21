const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getPickupTracking } = require("../controllers/trackingController");

const router = express.Router();

// GET /api/pickups/:id/tracking - protected, verifies ownership
router.get("/:id/tracking", requireAuth, getPickupTracking);

module.exports = router;
