require("dotenv").config();
const prisma = require("../src/db/client");

/**
 * Retention Cleanup Script for Vehicle Locations
 * Deletes vehicle location telemetry older than retention threshold (default 7 days).
 * 
 * Usage:
 *   node scripts/cleanOldLocations.js [--dry-run] [--days=7]
 */
async function cleanOldLocations() {
  const isDryRun = process.argv.includes("--dry-run");
  const daysArg = process.argv.find((a) => a.startsWith("--days="));
  const retentionDays = daysArg
    ? parseInt(daysArg.split("=")[1], 10)
    : parseInt(process.env.LOCATION_RETENTION_DAYS || "7", 10);

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  console.log(`[Location Cleanup] Cutoff date: ${cutoffDate.toISOString()} (${retentionDays} days retention)`);

  const countOlder = await prisma.vehicleLocation.count({
    where: {
      recordedAt: { lt: cutoffDate },
    },
  });

  console.log(`[Location Cleanup] Found ${countOlder} records older than ${retentionDays} days.`);

  if (countOlder === 0) {
    console.log("[Location Cleanup] Nothing to clean.");
    return;
  }

  if (isDryRun) {
    console.log(`[Location Cleanup] [DRY RUN] Would delete ${countOlder} rows.`);
  } else {
    const deleted = await prisma.vehicleLocation.deleteMany({
      where: {
        recordedAt: { lt: cutoffDate },
      },
    });
    console.log(`[Location Cleanup] Successfully purged ${deleted.count} old location records.`);
  }
}

if (require.main === module) {
  cleanOldLocations()
    .catch((err) => {
      console.error("[Location Cleanup] Error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { cleanOldLocations };
