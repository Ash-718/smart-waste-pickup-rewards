const express = require("express");
const { create, list, getById, assign, updateStatus } = require("../controllers/pickupController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/", create);
router.get("/", list);
router.get("/:id", getById);
router.patch("/:id/assign", requireRole("admin"), assign);
router.patch("/:id/status", requireRole("admin"), updateStatus);

module.exports = router;
