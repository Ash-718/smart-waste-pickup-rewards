const prisma = require("../db/client");
const { HttpError } = require("../middleware/errorHandler");
const { broadcastPickupStatus } = require("../socket");

/**
 * Centralized transactional assignment service.
 * Enforces:
 * 1. Every assignment creates a PickupAssignment row.
 * 2. Vehicles MUST have an assigned driver (driverId). No admin fallback.
 * 3. Atomic archiving of any previous active assignment on the pickup.
 * 4. Synchronization of pickup.assignedAdminId with vehicle.driverId.
 */
async function assignVehicleToPickup({ pickupId, vehicleId, adminUserId, slotPeriod, requestedDate }) {
  if (!pickupId) throw new HttpError(400, "Pickup ID is required");
  if (!vehicleId) throw new HttpError(400, "Vehicle ID is required");
  if (!adminUserId) throw new HttpError(401, "Admin user ID is required");

  // Run in a single transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Verify pickup existence and eligibility
    const pickup = await tx.pickup.findUnique({
      where: { id: pickupId },
      include: { assignments: { where: { isActive: true } } },
    });

    if (!pickup) {
      throw new HttpError(404, "Pickup not found");
    }

    if (["on_the_way", "arrived"].includes(pickup.status)) {
      throw new HttpError(
        409,
        `Cannot reassign vehicle: pickup is already in transit ('${pickup.status}'). The current trip must be completed before reassigning.`
      );
    }

    if (["completed", "cancelled", "rejected"].includes(pickup.status)) {
      throw new HttpError(400, `Cannot assign a pickup that is already ${pickup.status}`);
    }

    // 2. Fetch vehicle and strictly validate driver existence
    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        driver: { select: { id: true, name: true, email: true, phone: true, role: true } },
      },
    });

    if (!vehicle) {
      throw new HttpError(404, "Vehicle not found");
    }

    if (!vehicle.isActive) {
      throw new HttpError(400, `Cannot assign inactive vehicle (${vehicle.registrationNo})`);
    }

    if (!vehicle.driverId || !vehicle.driver) {
      throw new HttpError(
        400,
        `Cannot assign vehicle "${vehicle.registrationNo}": Vehicle has no assigned driver/collector.`
      );
    }

    if (vehicle.driver.role !== "collector") {
      throw new HttpError(
        400,
        `Cannot assign vehicle "${vehicle.registrationNo}": Assigned user "${vehicle.driver.name}" must have role 'collector'.`
      );
    }

    // 3. Archive any existing active assignment on this pickup (preserve full history)
    await tx.pickupAssignment.updateMany({
      where: {
        pickupId,
        isActive: true,
      },
      data: {
        isActive: false,
        unassignedAt: new Date(),
      },
    });

    // 4. Create new PickupAssignment row (source of truth)
    const assignment = await tx.pickupAssignment.create({
      data: {
        pickupId,
        vehicleId: vehicle.id,
        assignedById: adminUserId,
        assignedAt: new Date(),
        startedAt: null, // Reset on new/reassignment
        arrivedAt: null, // Reset on new/reassignment
        isActive: true,
      },
      include: {
        vehicle: {
          include: {
            driver: { select: { id: true, name: true, phone: true, role: true } },
          },
        },
      },
    });

    // 5. Synchronize pickup row with assigned driver and assigned timestamp
    const updatedPickup = await tx.pickup.update({
      where: { id: pickupId },
      data: {
        status: "assigned",
        assignedAdminId: vehicle.driverId, // Strictly vehicle.driverId
        assignedAt: new Date(),
        ...(slotPeriod ? { slotPeriod } : {}),
        ...(requestedDate ? { requestedDate } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
        assignments: { where: { isActive: true }, include: { vehicle: true } },
      },
    });

    const result = { pickup: updatedPickup, assignment };
    broadcastPickupStatus(pickupId, "assigned", {
      vehicleId: vehicle.id,
      registrationNo: vehicle.registrationNo,
      driverName: vehicle.driver.name,
    });

    return result;
  });
}

module.exports = { assignVehicleToPickup };
