// Single source of truth for tunable business rules.
// The NGO / team can retune these without touching route or service logic.

const WASTE_TYPES = [
  { value: "PAPER_CARDBOARD", label: "Paper & Cardboard" },
  { value: "PLASTIC", label: "Plastic" },
  { value: "METAL", label: "Metal" },
  { value: "GLASS", label: "Glass" },
  { value: "E_WASTE", label: "E-Waste" },
  { value: "MIXED_RECYCLABLES", label: "Mixed Recyclables" },
];

const QUANTITY_BANDS = [
  { value: "SMALL", label: "Small (<2kg)", points: 10 },
  { value: "MEDIUM", label: "Medium (2-5kg)", points: 25 },
  { value: "LARGE", label: "Large (>5kg)", points: 50 },
];

const SLOT_PERIODS = [
  { value: "MORNING", label: "Morning (8-11 AM)" },
  { value: "AFTERNOON", label: "Afternoon (12-3 PM)" },
  { value: "EVENING", label: "Evening (4-7 PM)" },
];

const PICKUP_STATUSES = ["requested", "assigned", "completed", "cancelled"];

// Points awarded on pickup completion = QUANTITY_BANDS[band].points
function pointsForQuantityBand(band) {
  const match = QUANTITY_BANDS.find((b) => b.value === band);
  return match ? match.points : 0;
}

const BADGES = [
  { name: "Bronze", minPoints: 50, description: "Earned 50+ Green Points" },
  { name: "Silver", minPoints: 150, description: "Earned 150+ Green Points" },
  { name: "Gold", minPoints: 300, description: "Earned 300+ Green Points" },
];

// Sample reward catalog — placeholder data the NGO will replace with real partner rewards.
const STARTER_REWARDS = [
  {
    name: "Reusable Tote Bag",
    pointsRequired: 50,
    stock: 100,
    description: "A durable cotton tote bag, sample reward.",
  },
  {
    name: "Plant Sapling",
    pointsRequired: 30,
    stock: 100,
    description: "A sapling to plant at home, sample reward.",
  },
  {
    name: "Eco-Store Voucher (Rs. 100)",
    pointsRequired: 150,
    stock: 50,
    description: "Voucher for a partnered eco-friendly store, sample reward.",
  },
];

const REMINDER_THRESHOLD_DAYS = parseInt(
  process.env.REMINDER_THRESHOLD_DAYS || "14",
  10
);

module.exports = {
  WASTE_TYPES,
  QUANTITY_BANDS,
  SLOT_PERIODS,
  PICKUP_STATUSES,
  BADGES,
  STARTER_REWARDS,
  REMINDER_THRESHOLD_DAYS,
  pointsForQuantityBand,
};
