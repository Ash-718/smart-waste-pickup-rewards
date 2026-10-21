require("dotenv").config();
const prisma = require("./client");

/**
 * Safe backfill script for existing LIVE pickups with status 'assigned'.
 * 
 * Rules:
 * 1. Only backfills live pickups in 'assigned' status (skips completed, cancelled, rejected).
 * 2. Does NOT create fake fleet vehicles. Uses one inactive placeholder vehicle: "LEGACY-UNASSIGNED".
 * 3. Links existing driver if collector has a vehicle, otherwise links the inactive placeholder.
 * 4. For assigned_by_id, falls back to the first admin user and logs it.
 * 5. Run with `--dry-run` to preview without writing to the database.
 * 
 * Usage:
 *   node src/db/backfillAssignments.js [--dry-run]
 */
async function backfillAssignments() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`[Backfill] Starting pickup assignments backfill (Dry run: ${isDryRun})...`);

  // 1. Fetch only LIVE assigned pickups that do not yet have an assignment row
  const liveAssignedPickups = await prisma.pickup.findMany({
    where: {
      status: "assigned",
      assignments: { none: {} },
    },
    include: {
      assignedAdmin: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[Backfill] Found ${liveAssignedPickups.length} live 'assigned' pickups needing backfill.`);
  if (liveAssignedPickups.length === 0) {
    console.log("[Backfill] No live pickups need backfilling. Completed/cancelled/rejected pickups were safely skipped.");
    return;
  }

  // 2. Fetch or prepare the single inactive placeholder vehicle "LEGACY-UNASSIGNED"
  let placeholderVehicle = await prisma.vehicle.findUnique({
    where: { registrationNo: "LEGACY-UNASSIGNED" },
  });

  if (!placeholderVehicle) {
    if (isDryRun) {
      console.log("[Backfill] [Dry Run] Would create inactive placeholder vehicle: 'LEGACY-UNASSIGNED'");
      placeholderVehicle = { id: "mock-legacy-unassigned-id", registrationNo: "LEGACY-UNASSIGNED" };
    } else {
      placeholderVehicle = await prisma.vehicle.create({
        data: {
          registrationNo: "LEGACY-UNASSIGNED",
          type: "Legacy Placeholder",
          capacity: 0,
          isActive: false, // Inactive placeholder as specified
        },
      });
      console.log(`[Backfill] Created inactive placeholder vehicle (ID: ${placeholderVehicle.id})`);
    }
  }

  // 3. Find first admin user for assigned_by_id fallback
  const firstAdmin = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });

  if (!firstAdmin) {
    throw new Error("[Backfill] Aborted: No admin user found in database for assigned_by_id fallback.");
  }
  console.log(`[Backfill] First admin found for fallback: ${firstAdmin.name} (${firstAdmin.email})`);

  // 4. Backfill each live pickup
  let count = 0;
  for (const pickup of liveAssignedPickups) {
    // Check if the assigned collector already has a vehicle
    let targetVehicleId = placeholderVehicle.id;
    let assignedById = firstAdmin.id;

    if (pickup.assignedAdminId) {
      const driverVehicle = await prisma.vehicle.findUnique({
        where: { driverId: pickup.assignedAdminId },
      });
      if (driverVehicle) {
        targetVehicleId = driverVehicle.id;
      }

      // Check if assignedAdmin was an admin
      if (pickup.assignedAdmin && pickup.assignedAdmin.role === "admin") {
        assignedById = pickup.assignedAdmin.id;
      } else {
        console.log(
          `[Backfill] Pickup ${pickup.id}: assignedAdmin is collector (${pickup.assignedAdmin?.name || pickup.assignedAdminId}). Falling back assigned_by_id to first admin (${firstAdmin.name}).`
        );
      }
    } else {
      console.log(
        `[Backfill] Pickup ${pickup.id}: No assignedAdminId. Falling back assigned_by_id to first admin (${firstAdmin.name}).`
      );
    }

    console.log(
      `[Backfill] Pickup ${pickup.id} -> Vehicle: ${targetVehicleId} | AssignedBy: ${assignedById} | is_active: true`
    );

    if (!isDryRun) {
      await prisma.pickupAssignment.create({
        data: {
          pickupId: pickup.id,
          vehicleId: targetVehicleId,
          assignedById: assignedById,
          assignedAt: pickup.assignedAt || pickup.createdAt,
          isActive: true, // Live assigned pickup
        },
      });
    }
    count++;
  }

  console.log(`[Backfill] Finished: ${count} live pickup assignments ${isDryRun ? "evaluated (dry run)" : "created"}.`);
}

if (require.main === module) {
  backfillAssignments()
    .catch((err) => {
      console.error("[Backfill] Error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { backfillAssignments };
