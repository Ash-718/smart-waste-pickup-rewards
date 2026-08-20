const { z } = require("zod");
const {
  WASTE_TYPES,
  QUANTITY_BANDS,
  SLOT_PERIODS,
  PICKUP_STATUSES,
} = require("../config/constants");

const wasteTypeValues = WASTE_TYPES.map((w) => w.value);
const quantityBandValues = QUANTITY_BANDS.map((q) => q.value);
const slotPeriodValues = SLOT_PERIODS.map((s) => s.value);

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(6).optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone is required",
    path: ["email"],
  });

const loginSchema = z
  .object({
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(6).optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone is required",
    path: ["email"],
  });

const createPickupSchema = z.object({
  wasteType: z.enum(wasteTypeValues),
  quantityBand: z.enum(quantityBandValues),
  address: z.string().trim().min(1, "Address is required"),
  slotPeriod: z.enum(slotPeriodValues),
  requestedDate: z.coerce.date(),
  photoUrl: z.string().url().optional(),
});

const assignPickupSchema = z.object({
  adminId: z.string().uuid().optional(),
  slotPeriod: z.enum(slotPeriodValues).optional(),
  requestedDate: z.coerce.date().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(PICKUP_STATUSES),
});

const redeemRewardSchema = z.object({});

module.exports = {
  registerSchema,
  loginSchema,
  createPickupSchema,
  assignPickupSchema,
  updateStatusSchema,
  redeemRewardSchema,
};
