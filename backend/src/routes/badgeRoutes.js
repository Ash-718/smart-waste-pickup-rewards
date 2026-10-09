const express = require("express");
const { list, create } = require("../controllers/badgeController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, requireRole("admin"), create);

module.exports = router;
