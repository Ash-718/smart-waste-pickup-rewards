const express = require("express");
const { list } = require("../controllers/badgeController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, list);

module.exports = router;
