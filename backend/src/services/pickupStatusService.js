const prisma = require("../db/client");
const { HttpError } = require("../middleware/errorHandler");
const { completePickupAndAwardPoints } = require("./pointsService");
const { broadcastPickupStatus } = require("../socket");

function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Valid pickup status transitions map.
 */
const VALID_TRANSITIONS = {
  requested: ["assigned", "cancelled", "rejected"],
  assigned: ["on_the_way", "cancelled", "rejected"],
  on_the_way: ["arrived"],
  arrived: ["completed"],
  completed: [],
  cancelled: [],
  rejected: [],
};

/**
 * Validates role-based status transition permission.
 * - Admin: can transition to cancelled, rejected, or force complete.
 * - Collector (driver): can transition assigned -> on_the_way -> arrived -> completed.
 * - Citizen: can cancel only if status is 'requested' or 'assigned'.
 */
function assertTransitionAllowed(currentStatus, targetStatus, role, isOwner) {
  // Allow idempotent completion retry (network retry)
  if (currentStatus === "completed" && targetStatus === "completed") {
    return;
  }

  // Admins can force complete in-progress pickups directly
  if (
    role === "admin" &&
    targetStatus === "completed" &&
    ["assigned", "on_the_way", "arrived"].includes(currentStatus)
  ) {
    return;
  }

  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    throw new HttpError(
      400,
      `Invalid status transition: cannot move pickup from '${currentStatus}' to '${targetStatus}'`
    );
  }

  if (role === "citizen") {
    if (targetStatus !== "cancelled") {
      throw new HttpError(403, "Citizens may only cancel their pickup requests");
    }
    if (!["requested", "assigned"].includes(currentStatus)) {
      throw new HttpError(
        400,
        "Cannot cancel pickup once the driver has started the trip ('on_the_way' or later)"
      );
    }
    if (!isOwner) {
      throw new HttpError(403, "Forbidden: You can only cancel your own pickups");
    }
  }

  if (role === "collector") {
    if (!["on_the_way", "arrived", "completed"].includes(targetStatus)) {
      throw new HttpError(403, `Collectors are not permitted to set status to '${targetStatus}'`);
    }
  }
}

/**
 * Centralized transactional pickup status transition service.
 * Used by admin, driver, and citizen endpoints.
 * 
 * isActive Lifecycle Rule:
 * - isActive remains true while pickup is in progress: ['assigned', 'on_the_way', 'arrived'].
 * - isActive is set to false when pickup reaches terminal state: ['completed', 'cancelled', 'rejected'].
 * - Tracking remains fully accessible for completed pickups by reading the latest assignment.
 */
async function transitionPickupStatus({
  pickupId,
  targetStatus,
  user,
  rejectionReason,
  wasteQuantity,
}) {
  try {
    return await prisma.$transaction(async (tx) => {
    const pickup = await tx.pickup.findUnique({
      where: { id: pickupId },
      include: {
        assignments: { where: { isActive: true }, include: { vehicle: true } },
      },
    });

    if (!pickup) {
      throw new HttpError(404, "Pickup not found");
    }

    const isOwner = user && pickup.userId === user.id;
    assertTransitionAllowed(pickup.status, targetStatus, user.role, isOwner);

    // If already completed and requested completion again, return idempotently
    if (pickup.status === "completed" && targetStatus === "completed") {
      const existingLedger = await tx.pointsLedger.findUnique({
        where: { pickupId },
      });
      return { pickup, ledgerEntry: existingLedger, newBadges: [] };
    }

    // Validate start trip: block if placeholder vehicle or inactive vehicle
    if (targetStatus === "on_the_way") {
      const activeAssignment = pickup.assignments[0];
      if (
        !activeAssignment ||
        activeAssignment.vehicle.registrationNo === "LEGACY-UNASSIGNED" ||
        !activeAssignment.vehicle.isActive
      ) {
        throw new HttpError(
          400,
          "Cannot start trip: Pickup is assigned to placeholder vehicle 'LEGACY-UNASSIGNED'. Admin must assign an active fleet vehicle with a driver before starting the trip."
        );
      }
    }

    // Validate arrival: must be within arrival radius unless skipped by server env flag
    if (targetStatus === "arrived") {
      const skipRadius =
        process.env.DEV_SKIP === "true" || process.env.DEV_SKIP_ARRIVAL_RADIUS === "true";
      if (!skipRadius) {
        if (
          pickup.latitude === null ||
          pickup.latitude === undefined ||
          pickup.longitude === null ||
          pickup.longitude === undefined
        ) {
          throw new HttpError(
            400,
            "Cannot mark arrived: Pickup destination coordinates are missing. Admin or citizen must set pickup latitude and longitude."
          );
        }

        const activeAssignment = pickup.assignments[0];
        const vehicle = activeAssignment?.vehicle;
        const vLat = vehicle?.currentLat;
        const vLng = vehicle?.currentLng;
        const lastLocAt = vehicle?.lastLocationAt;

        if (
          vLat === null ||
          vLat === undefined ||
          vLng === null ||
          vLng === undefined ||
          !lastLocAt
        ) {
          throw new HttpError(
            400,
            "Cannot mark arrived: No GPS location received from driver vehicle yet. Enable location sharing."
          );
        }

        // Reject stale vehicle location (>60 seconds)
        const ageSeconds = Math.round((Date.now() - new Date(lastLocAt).getTime()) / 1000);
        if (ageSeconds > 60) {
          throw new HttpError(
            400,
            `Cannot mark arrived: Vehicle location is stale (${ageSeconds}s old). Driver must transmit a fresh GPS update within the last 60 seconds.`
          );
        }

        const maxRadius = parseInt(process.env.ARRIVAL_RADIUS_METERS || "300", 10);
        const dist = calculateHaversineMeters(vLat, vLng, pickup.latitude, pickup.longitude);
        if (dist > maxRadius) {
          throw new HttpError(
            400,
            `Cannot mark arrived: Vehicle is ~${dist}m away from the pickup location (allowed radius: ${maxRadius}m). Move closer to the destination.`
          );
        }
      }
    }

    // If collector, verify this collector is the driver of the active assigned vehicle
    if (user.role === "collector") {
      const activeAssignment = pickup.assignments[0];
      if (!activeAssignment) {
        throw new HttpError(400, "Cannot update status: No active vehicle assigned to this pickup");
      }
      if (activeAssignment.vehicle.driverId !== user.id && pickup.assignedAdminId !== user.id) {
        throw new HttpError(403, "Forbidden: You are not the assigned driver for this pickup");
      }
    }

    const now = new Date();
    const isTerminal = ["completed", "cancelled", "rejected"].includes(targetStatus);

    // 1. Update active assignment timestamps and isActive state
    if (pickup.assignments.length > 0) {
      const assignmentId = pickup.assignments[0].id;
      const assignmentUpdates = {};

      if (targetStatus === "on_the_way") assignmentUpdates.startedAt = now;
      if (targetStatus === "arrived") assignmentUpdates.arrivedAt = now;
      if (targetStatus === "completed") {
        assignmentUpdates.completedAt = now;
        assignmentUpdates.isActive = false; // Terminal: deactivate active assignment
      }
      if (targetStatus === "cancelled" || targetStatus === "rejected") {
        assignmentUpdates.unassignedAt = now;
        assignmentUpdates.isActive = false; // Terminal: deactivate active assignment
      }

      if (Object.keys(assignmentUpdates).length > 0) {
        await tx.pickupAssignment.update({
          where: { id: assignmentId },
          data: assignmentUpdates,
        });
      }
    }

    // 2. Handle completion and idempotent points award
    let ledgerEntry = null;
    let newBadges = [];

    if (targetStatus === "completed") {
      // Award points idempotently via pointsService
      const awardResult = await completePickupAndAwardPoints(tx, {
        ...pickup,
        wasteQuantity: wasteQuantity || pickup.wasteQuantity,
      });
      ledgerEntry = awardResult.ledgerEntry;
      newBadges = awardResult.newBadges;
    } else {
      // Update pickup status for non-completion transitions
      await tx.pickup.update({
        where: { id: pickupId },
        data: {
          status: targetStatus,
          ...(targetStatus === "rejected" && rejectionReason ? { rejectionReason } : {}),
          ...(wasteQuantity ? { wasteQuantity } : {}),
        },
      });
    }

    // 3. Return full updated pickup record
    const updatedPickup = await tx.pickup.findUnique({
      where: { id: pickupId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
        pointsLedgerEntry: true,
        assignments: {
          orderBy: { assignedAt: "desc" },
          take: 1,
          include: {
            vehicle: {
              include: {
                driver: { select: { id: true, name: true, phone: true, role: true } },
              },
            },
          },
        },
      },
    });

    broadcastPickupStatus(pickupId, targetStatus, {
      pointsEarned: ledgerEntry?.pointsEarned || null,
      newBadges: newBadges || [],
    });

    return { pickup: updatedPickup, ledgerEntry, newBadges };
  });
  } catch (err) {
    // If concurrent transaction failed due to unique violation on pointsLedger (pickupId),
    // re-read outside the aborted transaction and return the idempotent state cleanly.
    if (err.code === "P2002") {
      const fallbackPickup = await prisma.pickup.findUnique({
        where: { id: pickupId },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          assignedAdmin: { select: { id: true, name: true, role: true, email: true, phone: true } },
          pointsLedgerEntry: true,
          assignments: {
            orderBy: { assignedAt: "desc" },
            take: 1,
            include: {
              vehicle: {
                include: {
                  driver: { select: { id: true, name: true, phone: true, role: true } },
                },
              },
            },
          },
        },
      });
      const fallbackLedger = await prisma.pointsLedger.findUnique({
        where: { pickupId },
      });
      return { pickup: fallbackPickup, ledgerEntry: fallbackLedger, newBadges: [] };
    }
    throw err;
  }
}

module.exports = {
  VALID_TRANSITIONS,
  assertTransitionAllowed,
  transitionPickupStatus,
};
