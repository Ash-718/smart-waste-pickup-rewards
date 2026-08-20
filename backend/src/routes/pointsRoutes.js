const express = require("express");
const { balance, history } = require("../controllers/pointsController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/balance", balance);
router.get("/history", history);

module.exports = router;
