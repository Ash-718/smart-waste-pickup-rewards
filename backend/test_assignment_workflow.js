require("dotenv").config();
const prisma = require("./src/db/client");
const bcrypt = require("bcryptjs");
const { assignVehicleToPickup } = require("./src/services/assignmentService");

async function runAssignmentWorkflowTests() {
  console.log("====================================================");
  console.log("   TESTING PICKUP ASSIGNMENT WORKFLOW & VALIDATION  ");
  console.log("====================================================");

  const testSuffix = Date.now().toString().slice(-6);
  let citizen, collector, vehicle, inactiveVehicle, pickup;

  try {
    // 1. Create test citizen
    citizen = await prisma.user.create({
      data: {
        name: `Test Citizen ${testSuffix}`,
        email: `citizen_${testSuffix}@test.local`,
        passwordHash: await bcrypt.hash("password123", 10),
        role: "citizen",
      },
    });
    console.log("✓ Step 1: Created test citizen:", citizen.email);

    // 2. Create test collector
    collector = await prisma.user.create({
      data: {
        name: `Collector ${testSuffix}`,
        email: `collector_${testSuffix}@test.local`,
        passwordHash: await bcrypt.hash("password123", 10),
        role: "collector",
      },
    });
    console.log("✓ Step 2: Created test collector:", collector.email);

    // 3. Create active test vehicle with assigned collector
    vehicle = await prisma.vehicle.create({
      data: {
        registrationNo: `TST-${testSuffix}`,
        type: "Van",
        capacity: 450,
        driverId: collector.id,
        isActive: true,
      },
    });
    console.log("✓ Step 3: Created active test vehicle:", vehicle.registrationNo);

    // 4. Create inactive test vehicle
    inactiveVehicle = await prisma.vehicle.create({
      data: {
        registrationNo: `INA-${testSuffix}`,
        type: "Truck",
        capacity: 1000,
        isActive: false,
      },
    });
    console.log("✓ Step 4: Created inactive test vehicle:", inactiveVehicle.registrationNo);

    // 5. Create test pickup with requested status
    pickup = await prisma.pickup.create({
      data: {
        userId: citizen.id,
        wasteType: "PLASTIC",
        quantityBand: "MEDIUM",
        wasteQuantity: 4.2,
        address: "74 Eco Boulevard, Sector 5",
        latitude: 19.076,
        longitude: 72.8777,
        slotPeriod: "MORNING",
        requestedDate: new Date(),
        status: "requested",
      },
    });
    console.log("✓ Step 5: Created test pickup with status 'requested':", pickup.id);

    // 6. Test: Invalid vehicle ID should be rejected
    try {
      await assignVehicleToPickup({
        pickupId: pickup.id,
        vehicleId: "00000000-0000-0000-0000-000000000000",
        adminUserId: collector.id,
      });
      throw new Error("Expected failure for non-existent vehicle ID");
    } catch (err) {
      if (err.statusCode === 404 || err.message.includes("not found")) {
        console.log("✓ Step 6: Non-existent vehicle ID correctly rejected (404 Not Found)");
      } else {
        throw err;
      }
    }

    // 7. Test: Inactive vehicle should be rejected with 409
    try {
      await assignVehicleToPickup({
        pickupId: pickup.id,
        vehicleId: inactiveVehicle.id,
        adminUserId: collector.id,
      });
      throw new Error("Expected failure for inactive vehicle");
    } catch (err) {
      if (err.status === 409 || err.status === 400) {
        console.log("✓ Step 7: Inactive vehicle correctly rejected with conflict/validation error:", err.message);
      } else {
        throw err;
      }
    }

    // 8. Test: Valid assignment should succeed and transition status to 'assigned'
    const result = await assignVehicleToPickup({
      pickupId: pickup.id,
      vehicleId: vehicle.id,
      collectorId: collector.id,
      adminUserId: collector.id,
      slotPeriod: "AFTERNOON",
    });

    if (result.pickup.status !== "assigned") {
      throw new Error(`Expected status 'assigned', got '${result.pickup.status}'`);
    }
    if (result.pickup.assignedAdminId !== collector.id) {
      throw new Error(`Expected assignedAdminId '${collector.id}', got '${result.pickup.assignedAdminId}'`);
    }
    if (!result.assignment || !result.assignment.isActive) {
      throw new Error("Expected active assignment record");
    }
    console.log("✓ Step 8: Assignment succeeded! Status is 'assigned', collector correctly linked");

    // 9. Verify database persistence
    const dbPickup = await prisma.pickup.findUnique({
      where: { id: pickup.id },
      include: {
        assignments: { where: { isActive: true }, include: { vehicle: true } },
        assignedAdmin: true,
      },
    });

    if (dbPickup.status !== "assigned") {
      throw new Error("DB verification failed: status is not 'assigned'");
    }
    if (dbPickup.assignments[0]?.vehicle.registrationNo !== vehicle.registrationNo) {
      throw new Error("DB verification failed: vehicle registration does not match");
    }
    if (dbPickup.assignedAdmin?.id !== collector.id) {
      throw new Error("DB verification failed: assigned collector does not match");
    }
    console.log("✓ Step 9: Database persistence verified (status=assigned, vehicle=" + dbPickup.assignments[0].vehicle.registrationNo + ", staff=" + dbPickup.assignedAdmin.name + ")");

    // 10. Test: In-transit trip protection guard
    await prisma.pickup.update({
      where: { id: pickup.id },
      data: { status: "on_the_way" },
    });

    try {
      await assignVehicleToPickup({
        pickupId: pickup.id,
        vehicleId: vehicle.id,
        adminUserId: collector.id,
      });
      throw new Error("Expected 409 Conflict when reassigning in-transit pickup");
    } catch (err) {
      if (err.status === 409) {
        console.log("✓ Step 10: In-transit reassignment blocked with HTTP 409 Conflict:", err.message);
      } else {
        throw err;
      }
    }

    console.log("\n====================================================");
    console.log("   ALL ASSIGNMENT WORKFLOW TESTS PASSED (10/10)     ");
    console.log("====================================================");
  } finally {
    // Cleanup fixtures
    if (pickup) {
      await prisma.pickupAssignment.deleteMany({ where: { pickupId: pickup.id } }).catch(() => {});
      await prisma.pickup.delete({ where: { id: pickup.id } }).catch(() => {});
    }
    if (vehicle) {
      await prisma.vehicle.delete({ where: { id: vehicle.id } }).catch(() => {});
    }
    if (inactiveVehicle) {
      await prisma.vehicle.delete({ where: { id: inactiveVehicle.id } }).catch(() => {});
    }
    if (collector) {
      await prisma.user.delete({ where: { id: collector.id } }).catch(() => {});
    }
    if (citizen) {
      await prisma.user.delete({ where: { id: citizen.id } }).catch(() => {});
    }
    console.log("✓ Test teardown complete: all fixtures cleanly purged.");
    await prisma.$disconnect();
  }
}

runAssignmentWorkflowTests().catch((err) => {
  console.error("Assignment workflow test failed:", err);
  process.exit(1);
});
