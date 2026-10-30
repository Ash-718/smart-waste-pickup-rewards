const express = require("express");
const {
  applyCollector,
  checkApplicationStatus,
} = require("../controllers/collectorApplicationController");

const router = express.Router();

// Public onboarding routes
router.post("/apply", applyCollector);
router.get("/status", checkApplicationStatus);

module.exports = router;
