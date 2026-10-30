const bcrypt = require("bcryptjs");
const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const {
  collectorApplicationSchema,
  rejectApplicationSchema,
} = require("../validation/schemas");

const SALT_ROUNDS = 10;

/**
 * Public: Submit a new collector application
 * POST /api/collector-applications/apply
 */
const applyCollector = asyncHandler(async (req, res) => {
  const data = collectorApplicationSchema.parse(req.body);

  // 1. Check if user with this email or phone already exists
  const [existingUserEmail, existingUserPhone] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email } }),
    prisma.user.findUnique({ where: { phone: data.phone } }),
  ]);

  if (existingUserEmail) {
    throw new HttpError(409, "An account with this email already exists");
  }
  if (existingUserPhone) {
    throw new HttpError(409, "An account with this phone number already exists");
  }

  // 2. Check if an application already exists
  const existingApp = await prisma.collectorApplication.findFirst({
    where: {
      OR: [{ email: data.email }, { phone: data.phone }],
    },
  });

  if (existingApp) {
    if (existingApp.status === "pending") {
      throw new HttpError(
        409,
        "An application with this email or phone is already pending administrator review."
      );
    }
    if (existingApp.status === "approved") {
      throw new HttpError(
        409,
        "An approved account already exists for this applicant. Please log in with your credentials."
      );
    }
    // If previous application was rejected, allow re-applying by updating the existing application
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const updated = await prisma.collectorApplication.update({
      where: { id: existingApp.id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        address: data.address,
        licenseNumber: data.licenseNumber || null,
        vehicleTypePref: data.vehicleTypePref || null,
        status: "pending",
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
      },
    });

    return res.status(200).json({
      message: "Application re-submitted successfully and is pending administrator review.",
      application: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        licenseNumber: updated.licenseNumber,
        vehicleTypePref: updated.vehicleTypePref,
        status: updated.status,
        createdAt: updated.createdAt,
      },
    });
  }

  // 3. Create fresh application with 'pending' status
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const application = await prisma.collectorApplication.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      address: data.address,
      licenseNumber: data.licenseNumber || null,
      vehicleTypePref: data.vehicleTypePref || null,
      status: "pending",
    },
  });

  res.status(201).json({
    message: "Application submitted successfully and is pending administrator review.",
    application: {
      id: application.id,
      name: application.name,
      email: application.email,
      phone: application.phone,
      address: application.address,
      licenseNumber: application.licenseNumber,
      vehicleTypePref: application.vehicleTypePref,
      status: application.status,
      createdAt: application.createdAt,
    },
  });
});

/**
 * Public: Check collector application status
 * GET /api/collector-applications/status?query=...
 */
const checkApplicationStatus = asyncHandler(async (req, res) => {
  const query = (req.query.query || req.query.email || req.query.phone || "").trim();
  if (!query) {
    throw new HttpError(400, "Please provide an email or phone number to check status.");
  }

  const application = await prisma.collectorApplication.findFirst({
    where: {
      OR: [{ email: query }, { phone: query }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  if (!application) {
    throw new HttpError(404, "No application found for the provided email or phone.");
  }

  res.json({ application });
});

/**
 * Admin: List all collector applications with optional status filter
 * GET /api/admin/collector-applications
 */
const listApplications = asyncHandler(async (req, res) => {
  const { status, search } = req.query;

  const where = {};
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    where.status = status;
  }

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { licenseNumber: { contains: term, mode: "insensitive" } },
      { address: { contains: term, mode: "insensitive" } },
    ];
  }

  const applications = await prisma.collectorApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Resolve users and reviewers
  const allUserIds = [
    ...applications.map((a) => a.userId),
    ...applications.map((a) => a.reviewedById),
  ].filter(Boolean);

  const users = allUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, email: true, phone: true, role: true },
      })
    : [];

  const userMap = new Map();
  users.forEach((u) => userMap.set(u.id, u));

  // Attach vehicle info for approved applications
  const collectorUserIds = applications.map((a) => a.userId).filter(Boolean);
  const vehicles = collectorUserIds.length
    ? await prisma.vehicle.findMany({
        where: { driverId: { in: collectorUserIds } },
        select: { id: true, registrationNo: true, type: true, driverId: true, isActive: true },
      })
    : [];

  const vehicleMap = new Map();
  vehicles.forEach((v) => vehicleMap.set(v.driverId, v));

  const formatted = applications.map((app) => ({
    id: app.id,
    name: app.name,
    email: app.email,
    phone: app.phone,
    address: app.address,
    licenseNumber: app.licenseNumber,
    vehicleTypePref: app.vehicleTypePref,
    status: app.status,
    rejectionReason: app.rejectionReason,
    reviewedAt: app.reviewedAt,
    reviewedById: app.reviewedById,
    reviewedBy: app.reviewedById ? userMap.get(app.reviewedById) || null : null,
    userId: app.userId,
    user: app.userId ? userMap.get(app.userId) || null : null,
    assignedVehicle: app.userId ? vehicleMap.get(app.userId) || null : null,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  }));

  const [totalCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.collectorApplication.count(),
    prisma.collectorApplication.count({ where: { status: "pending" } }),
    prisma.collectorApplication.count({ where: { status: "approved" } }),
    prisma.collectorApplication.count({ where: { status: "rejected" } }),
  ]);

  const summary = {
    total: totalCount,
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
  };

  res.json({
    applications: formatted,
    summary,
  });
});

/**
 * Admin: Get single application detail
 * GET /api/admin/collector-applications/:id
 */
const getApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const app = await prisma.collectorApplication.findUnique({
    where: { id },
  });

  if (!app) {
    throw new HttpError(404, "Collector application not found");
  }

  const [user, reviewer, assignedVehicle] = await Promise.all([
    app.userId
      ? prisma.user.findUnique({
          where: { id: app.userId },
          select: { id: true, name: true, email: true, phone: true, role: true },
        })
      : null,
    app.reviewedById
      ? prisma.user.findUnique({
          where: { id: app.reviewedById },
          select: { id: true, name: true, email: true },
        })
      : null,
    app.userId
      ? prisma.vehicle.findUnique({
          where: { driverId: app.userId },
        })
      : null,
  ]);

  res.json({
    application: {
      id: app.id,
      name: app.name,
      email: app.email,
      phone: app.phone,
      address: app.address,
      licenseNumber: app.licenseNumber,
      vehicleTypePref: app.vehicleTypePref,
      status: app.status,
      rejectionReason: app.rejectionReason,
      reviewedAt: app.reviewedAt,
      reviewedById: app.reviewedById,
      reviewedBy: reviewer,
      userId: app.userId,
      user,
      assignedVehicle,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    },
  });
});

/**
 * Admin: Approve collector application
 * POST /api/admin/collector-applications/:id/approve
 * Body: { vehicleId?: string }
 */
const approveApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vehicleId } = req.body || {};

  const application = await prisma.collectorApplication.findUnique({
    where: { id },
  });

  if (!application) {
    throw new HttpError(404, "Collector application not found");
  }

  if (application.status === "approved") {
    throw new HttpError(400, "This application has already been approved");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create or activate User account with collector role
    let user = null;
    if (application.userId) {
      user = await tx.user.update({
        where: { id: application.userId },
        data: { role: "collector" },
      });
    } else {
      // Check if user with this email or phone exists
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [{ email: application.email }, { phone: application.phone }],
        },
      });

      if (existingUser) {
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: { role: "collector" },
        });
      } else {
        user = await tx.user.create({
          data: {
            name: application.name,
            email: application.email,
            phone: application.phone,
            passwordHash: application.passwordHash,
            role: "collector",
          },
        });
      }
    }

    // 2. Optionally assign vehicle to the driver
    let assignedVehicle = null;
    if (vehicleId) {
      const vehicle = await tx.vehicle.findUnique({
        where: { id: vehicleId },
      });
      if (!vehicle) {
        throw new HttpError(404, "Selected vehicle not found");
      }

      assignedVehicle = await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          driverId: user.id,
          isActive: true,
        },
      });
    }

    // 3. Mark application as approved
    const updatedApp = await tx.collectorApplication.update({
      where: { id: application.id },
      data: {
        status: "approved",
        userId: user.id,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    return { user, application: updatedApp, assignedVehicle };
  });

  res.json({
    message: "Collector application approved successfully. Collector account is now active.",
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      role: result.user.role,
    },
    application: result.application,
    assignedVehicle: result.assignedVehicle,
  });
});

/**
 * Admin: Reject collector application
 * POST /api/admin/collector-applications/:id/reject
 * Body: { reason: string }
 */
const rejectApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = rejectApplicationSchema.parse(req.body);

  const application = await prisma.collectorApplication.findUnique({
    where: { id },
  });

  if (!application) {
    throw new HttpError(404, "Collector application not found");
  }

  if (application.status === "approved") {
    throw new HttpError(
      400,
      "Cannot reject an already approved application. Please manage staff permissions in User Management instead."
    );
  }

  const updatedApp = await prisma.collectorApplication.update({
    where: { id: application.id },
    data: {
      status: "rejected",
      rejectionReason: reason,
      reviewedById: req.user.id,
      reviewedAt: new Date(),
    },
  });

  res.json({
    message: "Collector application has been rejected.",
    application: updatedApp,
  });
});

module.exports = {
  applyCollector,
  checkApplicationStatus,
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
};
