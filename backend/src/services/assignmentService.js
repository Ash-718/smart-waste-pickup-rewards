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
async function assignVehicleToPickup({ pickupId, vehicleId, collectorId, adminUserId, slotPeriod, requestedDate }) {
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
    let vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        driver: { select: { id: true, name: true, email: true, phone: true, role: true } },
      },
    });

    if (!vehicle) {
      throw new HttpError(404, "Vehicle not found");
    }

    if (!vehicle.isActive) {
      throw new HttpError(409, `Cannot assign inactive vehicle (${vehicle.registrationNo})`);
    }

    // If collectorId is provided and vehicle has no driver, or driver needs assignment:
    if (collectorId && vehicle.driverId !== collectorId) {
      const collector = await tx.user.findUnique({
        where: { id: collectorId },
        select: { id: true, name: true, role: true, email: true, phone: true },
      });
      if (!collector || collector.role !== "collector") {
        throw new HttpError(400, "Assigned staff member must have role 'collector'");
      }
      // Assign driver to vehicle if vehicle has no driver
      if (!vehicle.driverId) {
        vehicle = await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { driverId: collector.id },
          include: {
            driver: { select: { id: true, name: true, email: true, phone: true, role: true } },
          },
        });
      }
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

    // Check for conflicting in-transit trips on this vehicle
    const conflictingActiveTrip = await tx.pickupAssignment.findFirst({
      where: {
        vehicleId: vehicle.id,
        isActive: true,
        pickupId: { not: pickupId },
        pickup: {
          status: { in: ["on_the_way", "arrived"] },
        },
      },
      include: { pickup: true },
    });

    if (conflictingActiveTrip) {
      throw new HttpError(
        409,
        `Vehicle "${vehicle.registrationNo}" is currently en route for another active pickup (#${conflictingActiveTrip.pickup.id.slice(0, 8)}). Please wait for the current trip to complete or choose another vehicle.`
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

/**
 * Atomic batch assignment service for area/ward clusters.
 * Assigns multiple pickups in the same area to a single vehicle in a transaction.
 */
async function batchAssignVehicleToPickups({ pickupIds, vehicleId, adminUserId, slotPeriod, requestedDate }) {
  if (!Array.isArray(pickupIds) || pickupIds.length === 0) {
    throw new HttpError(400, "pickupIds must be a non-empty array of pickup IDs");
  }
  if (!vehicleId) throw new HttpError(400, "Vehicle ID is required");
  if (!adminUserId) throw new HttpError(401, "Admin user ID is required");

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch vehicle and strictly validate driver existence
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
      throw new HttpError(409, `Cannot assign inactive vehicle (${vehicle.registrationNo})`);
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

    // 2. Fetch all target pickups
    const pickups = await tx.pickup.findMany({
      where: { id: { in: pickupIds } },
    });

    if (pickups.length !== pickupIds.length) {
      throw new HttpError(404, "One or more pickup IDs were not found");
    }

    for (const p of pickups) {
      if (["on_the_way", "arrived"].includes(p.status)) {
        throw new HttpError(
          409,
          `Cannot assign pickup #${p.id.slice(0, 8)}: already in transit ('${p.status}')`
        );
      }
      if (["completed", "cancelled", "rejected"].includes(p.status)) {
        throw new HttpError(400, `Cannot assign pickup #${p.id.slice(0, 8)}: already ${p.status}`);
      }
    }

    // 3. Check for conflicting in-transit trip on the vehicle
    const conflictingActiveTrip = await tx.pickupAssignment.findFirst({
      where: {
        vehicleId: vehicle.id,
        isActive: true,
        pickupId: { notIn: pickupIds },
        pickup: {
          status: { in: ["on_the_way", "arrived"] },
        },
      },
      include: { pickup: true },
    });

    if (conflictingActiveTrip) {
      throw new HttpError(
        409,
        `Vehicle "${vehicle.registrationNo}" is currently en route for another active pickup (#${conflictingActiveTrip.pickup.id.slice(0, 8)}). Please wait for the current trip to complete.`
      );
    }

    // 4. Archive any existing active assignments on all these pickups
    await tx.pickupAssignment.updateMany({
      where: {
        pickupId: { in: pickupIds },
        isActive: true,
      },
      data: {
        isActive: false,
        unassignedAt: new Date(),
      },
    });

    // 5. Create new PickupAssignment rows for each pickup
    const now = new Date();
    const createdAssignments = [];
    for (const p of pickups) {
      const assignment = await tx.pickupAssignment.create({
        data: {
          pickupId: p.id,
          vehicleId: vehicle.id,
          assignedById: adminUserId,
          assignedAt: now,
          startedAt: null,
          arrivedAt: null,
          isActive: true,
        },
      });
      createdAssignments.push(assignment);
    }

    // 6. Update status and assignedAdminId on all pickups
    await tx.pickup.updateMany({
      where: { id: { in: pickupIds } },
      data: {
        status: "assigned",
        assignedAdminId: vehicle.driverId,
        assignedAt: now,
        ...(slotPeriod ? { slotPeriod } : {}),
        ...(requestedDate ? { requestedDate: new Date(requestedDate) } : {}),
      },
    });

    // 7. Broadcast status update for each pickup over Socket.IO
    for (const p of pickups) {
      broadcastPickupStatus(p.id, "assigned", {
        vehicleId: vehicle.id,
        registrationNo: vehicle.registrationNo,
        driverName: vehicle.driver.name,
      });
    }

    return {
      success: true,
      assignedCount: pickups.length,
      vehicle: {
        id: vehicle.id,
        registrationNo: vehicle.registrationNo,
        driver: vehicle.driver,
      },
      pickupIds,
      assignments: createdAssignments,
    };
  });
}

module.exports = { assignVehicleToPickup, batchAssignVehicleToPickups };
