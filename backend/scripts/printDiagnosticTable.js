const prisma = require("../src/db/client");

async function testFleet() {
  const drivers = [
    { email: "demo_collector@example.com", tag: "TRUCK-01" },
    { email: "demo_collector_suresh@example.com", tag: "TRUCK-02" },
    { email: "demo_collector_vikas@example.com", tag: "TRUCK-03" },
    { email: "demo_collector_sachin@example.com", tag: "TRUCK-04" },
    { email: "demo_collector_mahesh@example.com", tag: "TRUCK-05" },
    { email: "driver@wastewise.local", tag: "TRUCK-WW" },
  ];

  const now = Date.now();
  const rows = [];

  for (const d of drivers) {
    const user = await prisma.user.findUnique({
      where: { email: d.email },
      include: {
        vehicle: {
          include: {
            assignments: {
              where: { isActive: true },
              include: { pickup: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) {
      rows.push({
        Driver: d.email,
        Vehicle: "NOT FOUND",
        "Pickup ID": "N/A",
        "Last telemetry time": "N/A",
        "Update accepted": "NO (User missing)",
      });
      continue;
    }

    const vehicle = user.vehicle;
    if (!vehicle) {
      rows.push({
        Driver: user.name,
        Vehicle: "NO VEHICLE",
        "Pickup ID": "N/A",
        "Last telemetry time": "N/A",
        "Update accepted": "NO (No vehicle)",
      });
      continue;
    }

    const assignment = vehicle.assignments[0];
    const pickupId = assignment ? assignment.pickupId : "NONE";
    const lastLoc = vehicle.lastLocationAt;
    const ageSec = lastLoc ? Math.round((now - new Date(lastLoc).getTime()) / 1000) : null;
    const accepted =
      ageSec !== null && ageSec <= 10
        ? `YES (Live ${ageSec}s ago)`
        : ageSec !== null
        ? `STALE (${ageSec}s ago)`
        : "NO";

    rows.push({
      Driver: `${user.name} (${d.tag})`,
      Vehicle: vehicle.registrationNo,
      "Pickup ID": pickupId ? pickupId.slice(0, 8) + "..." : "NONE",
      "Last telemetry time": lastLoc ? lastLoc.toISOString() : "Never",
      "Update accepted": accepted,
    });
  }

  console.table(rows);
  process.exit(0);
}

testFleet().catch((err) => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
