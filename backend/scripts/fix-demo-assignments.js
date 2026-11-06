require("dotenv").config({ path: "./backend/.env" });
const prisma = require("../src/db/client");

async function run() {
  console.log("1. Completing stuck in-transit pickups #bfeeba17 and #3384be12...");

  // Complete #bfeeba17 (Sachin Kamble / MH-02-WW-4004)
  const p1 = await prisma.pickup.findFirst({ where: { id: { startsWith: "bfeeba17" } } });
  if (p1) {
    await prisma.pickup.update({
      where: { id: p1.id },
      data: { status: "completed" },
    });
    await prisma.pickupAssignment.updateMany({
      where: { pickupId: p1.id, isActive: true },
      data: { isActive: false, completedAt: new Date() },
    });
    console.log("✓ Completed pickup #bfeeba17. Vehicle MH-02-WW-4004 is now completely free!");
  }

  // Complete #3384be12 (Suresh Patil / MH-02-WW-2002)
  const p2 = await prisma.pickup.findFirst({ where: { id: { startsWith: "3384be12" } } });
  if (p2) {
    await prisma.pickup.update({
      where: { id: p2.id },
      data: { status: "completed" },
    });
    await prisma.pickupAssignment.updateMany({
      where: { pickupId: p2.id, isActive: true },
      data: { isActive: false, completedAt: new Date() },
    });
    console.log("✓ Completed pickup #3384be12. Vehicle MH-02-WW-2002 is now completely free!");
  }

  // Check if an unassigned vehicle exists for demo purposes
  const unassignedVehicle = await prisma.vehicle.findFirst({
    where: { driverId: null, registrationNo: { not: "LEGACY-UNASSIGNED" } },
  });

  if (!unassignedVehicle) {
    const newV = await prisma.vehicle.create({
      data: {
        registrationNo: "MH-02-WW-5005",
        type: "Mahindra Treo EV",
        capacity: 400,
        driverId: null,
        isActive: true,
        currentLat: 16.8450,
        currentLng: 74.6060,
        currentSpeed: 0,
        currentHeading: 0,
      },
    });
    console.log("✓ Created demo unassigned vehicle:", newV.registrationNo, "(Assigned Collector: Unassigned)");
  } else {
    console.log("✓ Found existing unassigned vehicle:", unassignedVehicle.registrationNo);
  }

  // Verify status of all vehicles
  const vehicles = await prisma.vehicle.findMany({
    where: { registrationNo: { not: "LEGACY-UNASSIGNED" } },
    include: {
      driver: { select: { id: true, name: true, email: true } },
      assignments: { where: { isActive: true }, include: { pickup: true } },
    },
    orderBy: { registrationNo: "asc" },
  });

  console.log("\n=== FLEET STATUS SUMMARY FOR DEMO ===");
  vehicles.forEach((v) => {
    const activeTrips = v.assignments.map((a) => `#${a.pickup.id.slice(0, 8)} (${a.pickup.status})`);
    console.log(
      `• ${v.registrationNo} | ${v.type} (${v.capacity}kg) | Driver: ${v.driver ? v.driver.name : "UNASSIGNED"} | Active Trips: ${activeTrips.length > 0 ? activeTrips.join(", ") : "0 (Ready for Dispatch)"}`
    );
  });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
