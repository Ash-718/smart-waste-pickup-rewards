const express = require("express");
const { list, redeem, create } = require("../controllers/rewardController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", list);
router.post("/", requireRole("admin"), create);
router.post("/:id/redeem", redeem);

module.exports = router;
