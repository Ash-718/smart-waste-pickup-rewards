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
  wasteQuantity: z.number().positive().optional(),
  address: z.string().trim().min(1, "Address is required"),
  slotPeriod: z.enum(slotPeriodValues),
  requestedDate: z.coerce.date(),
  photoUrl: z.string().trim().min(1).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

const assignPickupSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  collectorId: z.string().uuid().optional(),
  adminId: z.string().uuid().optional(),
  slotPeriod: z.enum(slotPeriodValues).optional(),
  requestedDate: z.coerce.date().optional(),
});

const updateStatusSchema = z
  .object({
    status: z.enum(PICKUP_STATUSES),
    rejectionReason: z.string().trim().optional(),
    wasteQuantity: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.status === "rejected") {
        return !!data.rejectionReason && data.rejectionReason.length > 0;
      }
      return true;
    },
    {
      message: "Rejection reason is mandatory when rejecting a pickup",
      path: ["rejectionReason"],
    }
  );

const redeemRewardSchema = z.object({});

const createRewardSchema = z.object({
  name: z.string().trim().min(1, "Reward name is required"),
  pointsRequired: z.number().int().positive("Points required must be positive"),
  stock: z.number().int().min(0, "Stock must be 0 or more"),
  description: z.string().trim().optional(),
});

const createBadgeSchema = z.object({
  name: z.string().trim().min(1, "Badge name is required"),
  minPoints: z.number().int().positive("Minimum points must be positive"),
  description: z.string().trim().optional(),
});

const createCollectorSchema = z
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

module.exports = {
  registerSchema,
  loginSchema,
  createPickupSchema,
  assignPickupSchema,
  updateStatusSchema,
  redeemRewardSchema,
  createRewardSchema,
  createBadgeSchema,
  createCollectorSchema,
};
