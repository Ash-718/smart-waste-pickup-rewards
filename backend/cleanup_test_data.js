/**
 * One-time cleanup script for purging test fixtures left behind by test scripts.
 * 
 * Usage:
 *   node cleanup_test_data.js            (Dry run by default)
 *   node cleanup_test_data.js --dry-run  (Explicit dry run)
 *   node cleanup_test_data.js --execute  (Performs the actual database deletion in a transaction)
 */

require("dotenv").config();
const prisma = require("./src/db/client");

// Explicit whitelist patterns - NEVER touched under any circumstance
const PROTECTED_EMAIL_PATTERNS = [
  /@wastewise\.local$/i,       // All seed demo accounts (admin, driver, citizen, rahul, stranger)
  /@gmail\.com$/i,             // Real developer personal accounts
  /ashmitsarode/i,             // Developer named account
];

const PROTECTED_VEHICLE_REG_PREFIXES = ["MH-02-WW-", "LEGACY-"];

// Real catalog reward and badge names from constants/seed
const REAL_CATALOG_REWARDS = new Set([
  "Reusable Tote Bag",
  "Eco-Store Voucher (Rs. 100)",
  "Plant Sapling",
  "Organic Compost Bag 5kg",
]);

const REAL_CATALOG_BADGES = new Set([
  "Bronze",
  "Silver",
  "Gold",
  "Platinum Zero Waste Hero",
]);

// Anchored test email patterns
const ANCHORED_TEST_EMAIL_PATTERNS = [
  /^testcitizen_\d+@pruthvi\.ngo$/i,      // Ashmit Citizen test users from test_complete_flow.js
  /^suresh_\d+@pruthvi\.ngo$/i,           // Suresh Deshmukh test collectors from test_complete_flow.js
  /^qa_citizen_\d+@pruthvi\.ngo$/i,       // Ananya Sharma from qa_verification_test.js
  /^qacitizen_\d+@pruthvi\.ngo$/i,        // QA Test Citizen from qa_verification_test.js
  /^[a-z0-9_-]+@wastewise\.test$/i,       // test_tracking_and_sockets.js test accounts
  /^diagtest\d*-\d+@test\.local$/i,       // Ephemeral diagnostic test users
];

// Anchored test reward and badge patterns with mandatory timestamp suffix
const TEST_REWARD_PATTERNS = [
  /^Compost Pack \d+$/,
  /^Bamboo Toothbrush Pack QA \d+$/,
];

const TEST_BADGE_PATTERNS = [
  /^Hero Tier \d+$/,
  /^Eco Champion QA \d+$/,
];

// Anchored test vehicle registration patterns
const TEST_VEHICLE_PATTERNS = [
  /^TST-\d+$/i,
  /^FLW-\d+$/i,
  /^EV-\d+$/i,
];

function isProtectedEmail(email) {
  if (!email) return false;
  return PROTECTED_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

function isProtectedVehicle(registrationNo) {
  if (!registrationNo) return true;
  return PROTECTED_VEHICLE_REG_PREFIXES.some((prefix) => registrationNo.startsWith(prefix));
}

function isTestUser(user) {
  const email = user.email || "";

  for (const pattern of ANCHORED_TEST_EMAIL_PATTERNS) {
    if (pattern.test(email)) return true;
  }

  // Ephemeral test collector without email created by QA script
  if (!email && user.name === "Sunil Jadhav" && user.role === "collector") {
    return true;
  }

  return false;
}

function isTestReward(reward) {
  if (REAL_CATALOG_REWARDS.has(reward.name)) return false;
  return TEST_REWARD_PATTERNS.some((p) => p.test(reward.name));
}

function isTestBadge(badge) {
  if (REAL_CATALOG_BADGES.has(badge.name)) return false;
  return TEST_BADGE_PATTERNS.some((p) => p.test(badge.name));
}

function isTestVehicle(vehicle, targetUserIds) {
  if (isProtectedVehicle(vehicle.registrationNo)) return false;
  if (TEST_VEHICLE_PATTERNS.some((p) => p.test(vehicle.registrationNo))) return true;
  if (vehicle.driverId && targetUserIds.includes(vehicle.driverId)) return true;
  return false;
}

async function runCleanup() {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const isDryRun = !isExecute;

  // Guard 1: Refuse to run in production
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PROD_CLEANUP) {
    console.error("\n❌ BLOCKED: Running cleanup in production environment is prohibited.");
    console.error("Set ALLOW_PROD_CLEANUP=true if you explicitly intended to run this in production.\n");
    process.exit(1);
  }

  // Guard 2: Require typed confirmation for execute mode
  if (isExecute) {
    let confirmed = false;
    const confirmFlag = args.find((a) => a.startsWith("--confirm="));
    const confirmVal = confirmFlag ? confirmFlag.split("=")[1] : null;

    if (confirmVal === "DELETE" || confirmVal === "YES_DELETE_TEST_DATA") {
      confirmed = true;
    } else if (process.stdin.isTTY) {
      const readline = require("readline");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise((resolve) => {
        rl.question("\n⚠️ DANGER: Type 'DELETE' to confirm permanent deletion of test records: ", resolve);
      });
      rl.close();
      if (answer.trim() === "DELETE") {
        confirmed = true;
      }
    }

    if (!confirmed) {
      console.error("\n❌ EXECUTION ABORTED: Confirmation was not provided or did not match 'DELETE'.");
      console.error("To execute deletion, you must pass: node cleanup_test_data.js --execute --confirm=DELETE\n");
      process.exit(1);
    }
  }

  console.log("================================================================================");
  console.log(`   WASTEWISE TEST DATA CLEANUP UTILITY [${isDryRun ? "DRY RUN MODE" : "⚠️ EXECUTE MODE"}]`);
  console.log("================================================================================");

  // 1. Fetch current total counts in DB (before state)
  const [
    totalUsersBefore,
    totalPickupsBefore,
    totalAssignmentsBefore,
    totalLedgerBefore,
    totalUserBadgesBefore,
    totalRedemptionsBefore,
    totalVehiclesBefore,
    totalLocationsBefore,
    totalRewardsBefore,
    totalBadgesBefore,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.pickup.count(),
    prisma.pickupAssignment.count(),
    prisma.pointsLedger.count(),
    prisma.userBadge.count(),
    prisma.rewardRedemption.count(),
    prisma.vehicle.count(),
    prisma.vehicleLocation.count(),
    prisma.reward.count(),
    prisma.badge.count(),
  ]);

  // 2. Fetch all users and partition into test vs protected
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const targetUsers = [];
  const protectedUsers = [];

  for (const user of allUsers) {
    if (isProtectedEmail(user.email)) {
      protectedUsers.push(user);
    } else if (isTestUser(user)) {
      if (isProtectedEmail(user.email)) {
        throw new Error(`CRITICAL GUARD: Conflict detected! ${user.email} matched protected whitelist.`);
      }
      targetUsers.push(user);
    } else {
      protectedUsers.push(user);
    }
  }

  const targetUserIds = targetUsers.map((u) => u.id);
  const protectedUserIds = protectedUsers.map((u) => u.id);

  // 3. Identify test vehicles and locations
  const allVehicles = await prisma.vehicle.findMany({
    select: { id: true, registrationNo: true, driverId: true, type: true },
  });
  const targetVehicles = allVehicles.filter((v) => isTestVehicle(v, targetUserIds));
  const targetVehicleIds = targetVehicles.map((v) => v.id);

  const targetVehicleLocations = await prisma.vehicleLocation.findMany({
    where: { vehicleId: { in: targetVehicleIds } },
    select: { id: true, vehicleId: true },
  });
  const targetVehicleLocationIds = targetVehicleLocations.map((l) => l.id);

  // 4. Identify related Pickups
  const targetPickups = await prisma.pickup.findMany({
    where: { userId: { in: targetUserIds } },
    select: { id: true, address: true, status: true, userId: true, wasteQuantity: true },
  });
  const targetPickupIds = targetPickups.map((p) => p.id);

  // 5. Verify whether any pickup owned by a PROTECTED user references a target vehicle or collector
  const protectedPickupsWithTestRefs = await prisma.pickup.findMany({
    where: {
      userId: { in: protectedUserIds },
      OR: [
        { assignedAdminId: { in: targetUserIds } },
        { assignments: { some: { vehicleId: { in: targetVehicleIds } } } },
        { assignments: { some: { vehicle: { driverId: { in: targetUserIds } } } } },
      ],
    },
    include: {
      user: { select: { name: true, email: true } },
      assignedAdmin: { select: { name: true, email: true } },
      assignments: { include: { vehicle: { include: { driver: true } } } },
    },
  });

  // 6. Identify related Pickup Assignments
  const targetAssignments = await prisma.pickupAssignment.findMany({
    where: {
      OR: [
        { pickupId: { in: targetPickupIds } },
        { vehicleId: { in: targetVehicleIds } },
        { assignedById: { in: targetUserIds } },
      ],
    },
    select: { id: true, pickupId: true, vehicleId: true },
  });
  const targetAssignmentIds = targetAssignments.map((a) => a.id);

  // 7. Identify related Points Ledger entries
  const targetPointsLedger = await prisma.pointsLedger.findMany({
    where: {
      OR: [
        { pickupId: { in: targetPickupIds } },
        { userId: { in: targetUserIds } },
      ],
    },
    select: { id: true, pointsEarned: true, userId: true, pickupId: true },
  });
  const targetPointsLedgerIds = targetPointsLedger.map((pl) => pl.id);

  // 8. Identify related User Badges
  const targetUserBadges = await prisma.userBadge.findMany({
    where: { userId: { in: targetUserIds } },
    select: { userId: true, badgeId: true },
  });

  // 9. Identify related Reward Redemptions
  const targetRedemptions = await prisma.rewardRedemption.findMany({
    where: { userId: { in: targetUserIds } },
    select: { id: true, userId: true, rewardId: true },
  });
  const targetRedemptionIds = targetRedemptions.map((r) => r.id);

  // 10. Identify Test Rewards (Exact anchored timestamp pattern only)
  const allRewards = await prisma.reward.findMany({
    select: { id: true, name: true, pointsRequired: true, stock: true },
  });
  const targetRewards = allRewards.filter(isTestReward);
  const targetRewardIds = targetRewards.map((r) => r.id);

  // 11. Identify Test Badges (Exact anchored timestamp pattern only)
  const allBadges = await prisma.badge.findMany({
    select: { id: true, name: true, minPoints: true },
  });
  const targetBadges = allBadges.filter(isTestBadge);
  const targetBadgeIds = targetBadges.map((b) => b.id);

  // ========================================================================
  // DETAILED REPORT
  // ========================================================================

  console.log("\n🛡️ 1. PROTECTED ACCOUNTS (Will NEVER be touched):");
  protectedUsers.forEach((u) => {
    console.log(`   • [${u.role.toUpperCase()}] ${u.name} (${u.email || "No email"})`);
  });

  console.log("\n🔍 2. CHECK: DO ANY PROTECTED USER PICKUPS REFERENCE TARGETED COLLECTORS/VEHICLES?");
  if (protectedPickupsWithTestRefs.length === 0) {
    console.log("   ✅ None. Zero pickups owned by protected users reference targeted collectors or vehicles.");
  } else {
    console.log(`   ⚠️ Found ${protectedPickupsWithTestRefs.length} protected pickup(s) referencing targeted entities:`);
    protectedPickupsWithTestRefs.forEach((p) => {
      console.log(`      - Pickup #${p.id.slice(0, 8)} (${p.user?.name} - ${p.user?.email}):`);
      console.log(`        Assigned Admin: ${p.assignedAdmin?.name} (${p.assignedAdmin?.email})`);
      p.assignments.forEach((a) => {
        console.log(`        Vehicle: ${a.vehicle?.registrationNo}, Driver: ${a.vehicle?.driver?.name}`);
      });
    });
  }

  console.log("\n🎁 3. EXACT TEST REWARDS TARGETED FOR DELETION (Confirmed Non-Catalog, Timestamp-Suffixed):");
  targetRewards.forEach((r, idx) => {
    const isCatalog = REAL_CATALOG_REWARDS.has(r.name);
    console.log(`   ${idx + 1}. ID: ${r.id}`);
    console.log(`      Name: "${r.name}" | Points: ${r.pointsRequired} | Stock: ${r.stock}`);
    console.log(`      Catalog Item: ${isCatalog ? "⚠️ YES (PROTECTED)" : "NO (Ephemeral Test Item)"}`);
  });

  console.log("\n🏅 4. EXACT TEST BADGES TARGETED FOR DELETION (Confirmed Non-Catalog, Timestamp-Suffixed):");
  targetBadges.forEach((b, idx) => {
    const isCatalog = REAL_CATALOG_BADGES.has(b.name);
    console.log(`   ${idx + 1}. ID: ${b.id}`);
    console.log(`      Name: "${b.name}" | Min Points: ${b.minPoints}`);
    console.log(`      Catalog Item: ${isCatalog ? "⚠️ YES (PROTECTED)" : "NO (Ephemeral Test Item)"}`);
  });

  console.log("\n🚛 5. TEST VEHICLES TARGETED FOR DELETION:");
  if (targetVehicles.length === 0) {
    console.log("   • No test vehicles found matching TST-*, FLW-*, EV-*. (Existing MH-02-WW-* and LEGACY-* are protected).");
  } else {
    targetVehicles.forEach((v) => {
      console.log(`   • ID: ${v.id} | Reg: ${v.registrationNo} | Type: ${v.type}`);
    });
  }

  console.log(`\n📍 6. TEST VEHICLE LOCATIONS: ${targetVehicleLocations.length} row(s)`);

  console.log("\n================================================================================");
  console.log("📊 SUMMARY OF CURRENT VS TARGETED DELETION COUNTS:");
  console.log("================================================================================");
  console.log(`   Entity                  | Total in DB | Targeted for Deletion | Remaining After`);
  console.log(`   -----------------------------------------------------------------------------`);
  console.log(`   1. Users                | ${totalUsersBefore.toString().padStart(11)} | ${targetUsers.length.toString().padStart(21)} | ${(totalUsersBefore - targetUsers.length).toString().padStart(15)}`);
  console.log(`   2. Pickups              | ${totalPickupsBefore.toString().padStart(11)} | ${targetPickups.length.toString().padStart(21)} | ${(totalPickupsBefore - targetPickups.length).toString().padStart(15)}`);
  console.log(`   3. Pickup Assignments   | ${totalAssignmentsBefore.toString().padStart(11)} | ${targetAssignmentIds.length.toString().padStart(21)} | ${(totalAssignmentsBefore - targetAssignmentIds.length).toString().padStart(15)}`);
  console.log(`   4. Points Ledger Rows   | ${totalLedgerBefore.toString().padStart(11)} | ${targetPointsLedgerIds.length.toString().padStart(21)} | ${(totalLedgerBefore - targetPointsLedgerIds.length).toString().padStart(15)}`);
  console.log(`   5. User Badges Junction | ${totalUserBadgesBefore.toString().padStart(11)} | ${targetUserBadges.length.toString().padStart(21)} | ${(totalUserBadgesBefore - targetUserBadges.length).toString().padStart(15)}`);
  console.log(`   6. Reward Redemptions   | ${totalRedemptionsBefore.toString().padStart(11)} | ${targetRedemptionIds.length.toString().padStart(21)} | ${(totalRedemptionsBefore - targetRedemptionIds.length).toString().padStart(15)}`);
  console.log(`   7. Vehicles             | ${totalVehiclesBefore.toString().padStart(11)} | ${targetVehicles.length.toString().padStart(21)} | ${(totalVehiclesBefore - targetVehicles.length).toString().padStart(15)}`);
  console.log(`   8. Vehicle Locations    | ${totalLocationsBefore.toString().padStart(11)} | ${targetVehicleLocations.length.toString().padStart(21)} | ${(totalLocationsBefore - targetVehicleLocations.length).toString().padStart(15)}`);
  console.log(`   9. Rewards              | ${totalRewardsBefore.toString().padStart(11)} | ${targetRewards.length.toString().padStart(21)} | ${(totalRewardsBefore - targetRewards.length).toString().padStart(15)}`);
  console.log(`  10. Badges               | ${totalBadgesBefore.toString().padStart(11)} | ${targetBadges.length.toString().padStart(21)} | ${(totalBadgesBefore - targetBadges.length).toString().padStart(15)}`);
  console.log("================================================================================");

  if (isDryRun) {
    console.log("\n✅ [DRY RUN COMPLETE] Zero database rows were modified or deleted.");
    console.log("Awaiting user approval before executing deletion.");
    console.log("When approved, run:");
    console.log("   node cleanup_test_data.js --execute\n");
    return;
  }

  // EXECUTE MODE: Single atomic transaction
  console.log("\n⚠️ Executing deletion inside a SINGLE ATOMIC TRANSACTION...");

  const txResults = await prisma.$transaction(async (tx) => {
    // a. Points ledger
    const delLedger = await tx.pointsLedger.deleteMany({
      where: { id: { in: targetPointsLedgerIds } },
    });

    // b. User Badges
    const delUserBadges = await tx.userBadge.deleteMany({
      where: {
        OR: [
          { userId: { in: targetUserIds } },
          { badgeId: { in: targetBadgeIds } },
        ],
      },
    });

    // c. Reward Redemptions
    const delRedemptions = await tx.rewardRedemption.deleteMany({
      where: {
        OR: [
          { userId: { in: targetUserIds } },
          { rewardId: { in: targetRewardIds } },
        ],
      },
    });

    // d. Pickup assignments
    const delAssignments = await tx.pickupAssignment.deleteMany({
      where: { id: { in: targetAssignmentIds } },
    });

    // e. Pickups
    const delPickups = await tx.pickup.deleteMany({
      where: { id: { in: targetPickupIds } },
    });

    // f. Vehicle locations
    const delLocations = await tx.vehicleLocation.deleteMany({
      where: { id: { in: targetVehicleLocationIds } },
    });

    // g. Vehicles
    const delVehicles = await tx.vehicle.deleteMany({
      where: { id: { in: targetVehicleIds } },
    });

    // h. Test rewards
    const delRewards = await tx.reward.deleteMany({
      where: { id: { in: targetRewardIds } },
    });

    // i. Test badges
    const delBadges = await tx.badge.deleteMany({
      where: { id: { in: targetBadgeIds } },
    });

    // j. Users
    const delUsers = await tx.user.deleteMany({
      where: { id: { in: targetUserIds } },
    });

    return {
      users: delUsers.count,
      pickups: delPickups.count,
      pickupAssignments: delAssignments.count,
      pointsLedger: delLedger.count,
      userBadges: delUserBadges.count,
      rewardRedemptions: delRedemptions.count,
      vehicles: delVehicles.count,
      vehicleLocations: delLocations.count,
      rewards: delRewards.count,
      badges: delBadges.count,
    };
  });

  // Verify post-deletion counts
  const [
    totalUsersAfter,
    totalPickupsAfter,
    totalAssignmentsAfter,
    totalLedgerAfter,
    totalUserBadgesAfter,
    totalRedemptionsAfter,
    totalVehiclesAfter,
    totalLocationsAfter,
    totalRewardsAfter,
    totalBadgesAfter,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.pickup.count(),
    prisma.pickupAssignment.count(),
    prisma.pointsLedger.count(),
    prisma.userBadge.count(),
    prisma.rewardRedemption.count(),
    prisma.vehicle.count(),
    prisma.vehicleLocation.count(),
    prisma.reward.count(),
    prisma.badge.count(),
  ]);

  console.log("\n================================================================================");
  console.log("🎉 TRANSACTION COMMITTED SUCCESSFULLY. FINAL VERIFIED ROW COUNTS:");
  console.log("================================================================================");
  console.log(`   Entity                  | Before | Deleted in TX | After Deletion`);
  console.log(`   -----------------------------------------------------------------`);
  console.log(`   1. Users                | ${totalUsersBefore.toString().padStart(6)} | ${txResults.users.toString().padStart(13)} | ${totalUsersAfter.toString().padStart(14)}`);
  console.log(`   2. Pickups              | ${totalPickupsBefore.toString().padStart(6)} | ${txResults.pickups.toString().padStart(13)} | ${totalPickupsAfter.toString().padStart(14)}`);
  console.log(`   3. Pickup Assignments   | ${totalAssignmentsBefore.toString().padStart(6)} | ${txResults.pickupAssignments.toString().padStart(13)} | ${totalAssignmentsAfter.toString().padStart(14)}`);
  console.log(`   4. Points Ledger Rows   | ${totalLedgerBefore.toString().padStart(6)} | ${txResults.pointsLedger.toString().padStart(13)} | ${totalLedgerAfter.toString().padStart(14)}`);
  console.log(`   5. User Badges Junction | ${totalUserBadgesBefore.toString().padStart(6)} | ${txResults.userBadges.toString().padStart(13)} | ${totalUserBadgesAfter.toString().padStart(14)}`);
  console.log(`   6. Reward Redemptions   | ${totalRedemptionsBefore.toString().padStart(6)} | ${txResults.rewardRedemptions.toString().padStart(13)} | ${totalRedemptionsAfter.toString().padStart(14)}`);
  console.log(`   7. Vehicles             | ${totalVehiclesBefore.toString().padStart(6)} | ${txResults.vehicles.toString().padStart(13)} | ${totalVehiclesAfter.toString().padStart(14)}`);
  console.log(`   8. Vehicle Locations    | ${totalLocationsBefore.toString().padStart(6)} | ${txResults.vehicleLocations.toString().padStart(13)} | ${totalLocationsAfter.toString().padStart(14)}`);
  console.log(`   9. Rewards              | ${totalRewardsBefore.toString().padStart(6)} | ${txResults.rewards.toString().padStart(13)} | ${totalRewardsAfter.toString().padStart(14)}`);
  console.log(`  10. Badges               | ${totalBadgesBefore.toString().padStart(6)} | ${txResults.badges.toString().padStart(13)} | ${totalBadgesAfter.toString().padStart(14)}`);
  console.log("================================================================================");
}

runCleanup()
  .catch((err) => {
    console.error("\n❌ CLEANUP FAILED (Transaction rolled back):", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
