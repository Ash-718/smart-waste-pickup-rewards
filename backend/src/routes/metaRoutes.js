const express = require("express");
const {
  WASTE_TYPES,
  QUANTITY_BANDS,
  SLOT_PERIODS,
  REMINDER_THRESHOLD_DAYS,
} = require("../config/constants");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    wasteTypes: WASTE_TYPES,
    quantityBands: QUANTITY_BANDS,
    slotPeriods: SLOT_PERIODS,
    reminderThresholdDays: REMINDER_THRESHOLD_DAYS,
  });
});

module.exports = router;
