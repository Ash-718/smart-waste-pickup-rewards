const express = require("express");
const { list, redeem } = require("../controllers/rewardController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", list);
router.post("/:id/redeem", redeem);

module.exports = router;
