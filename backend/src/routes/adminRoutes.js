const express = require("express");
const { summary } = require("../controllers/adminController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard/summary", requireAuth, requireRole("admin"), summary);

module.exports = router;
