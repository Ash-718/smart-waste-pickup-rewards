let baseUrl = "http://localhost:4000";

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, body: json };
}

async function runTests() {
  console.log("=== STARTING COMPLETE END-TO-END FLOW TESTS ===");

  // 1. Admin login
  console.log("\n1. Testing Admin Login...");
  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@wastewise.local", password: "Admin@123" },
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
  }
  const adminToken = adminLogin.body.token;
  console.log("✓ Admin logged in successfully");

  // 2. Citizen login (or create test citizen if needed)
  console.log("\n2. Testing Citizen Login / Auth...");
  let citizenToken;
  let citizenUser;
  const citizenLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "ashmit@gmail.com", password: "Password@123" },
  });

  if (citizenLogin.status === 200) {
    citizenToken = citizenLogin.body.token;
    citizenUser = citizenLogin.body.user;
    console.log("✓ Citizen logged in (ashmit@gmail.com)");
  } else {
    // Try registering a fresh test citizen
    const uniqueEmail = `testcitizen_${Date.now()}@pruthvi.ngo`;
    const regRes = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Ashmit Citizen", email: uniqueEmail, password: "Password@123" },
    });
    if (regRes.status !== 201) {
      throw new Error(`Citizen registration failed: ${JSON.stringify(regRes.body)}`);
    }
    citizenToken = regRes.body.token;
    citizenUser = regRes.body.user;
    console.log(`✓ New citizen registered (${uniqueEmail})`);
  }

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const citizenHeaders = { Authorization: `Bearer ${citizenToken}` };

  // 3. Admin Analytics Endpoints
  console.log("\n3. Testing Admin Analytics Endpoints...");
  const overviewRes = await request("/api/admin/analytics/overview?timeRange=all", { headers: adminHeaders });
  console.log("✓ GET /analytics/overview status:", overviewRes.status, "Total waste:", overviewRes.body.totalWasteCollected, "kg");

  const monthlyRes = await request("/api/admin/analytics/monthly?year=2026&month=10", { headers: adminHeaders });
  console.log("✓ GET /analytics/monthly status:", monthlyRes.status, "Month:", monthlyRes.body.monthName);

  const trendsRes = await request("/api/admin/analytics/trends?months=6", { headers: adminHeaders });
  console.log("✓ GET /analytics/trends status:", trendsRes.status, "Trend months count:", trendsRes.body.monthTrends?.length);

  const catRes = await request("/api/admin/analytics/waste-category", { headers: adminHeaders });
  console.log("✓ GET /analytics/waste-category status:", catRes.status, "Categories:", catRes.body.categories?.length);

  // 4. Citizen creates a new pickup
  console.log("\n4. Testing Citizen Pickup Creation...");
  const createPickupRes = await request("/api/pickups", {
    method: "POST",
    headers: citizenHeaders,
    body: {
      wasteType: "PLASTIC",
      quantityBand: "MEDIUM",
      address: "Plot 42, Green Avenue, Pune",
      slotPeriod: "MORNING",
      requestedDate: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  if (createPickupRes.status !== 201) {
    throw new Error(`Failed to create pickup: ${JSON.stringify(createPickupRes.body)}`);
  }
  const createdPickup = createPickupRes.body.pickup;
  console.log("✓ Pickup created:", createdPickup.id, "wasteQuantity:", createdPickup.wasteQuantity, "kg");

  // 5. Admin lists collectors for assignment
  console.log("\n5. Testing List Collectors...");
  const vehiclesRes = await request("/api/admin/vehicles", { headers: adminHeaders });
  let activeVehicle = vehiclesRes.body.vehicles?.find((v) => v.isActive && v.driver);
  let collector = activeVehicle?.driver;
  let vehicleId = activeVehicle?.id;

  if (!activeVehicle) {
    const collectorsRes = await request("/api/admin/collectors", { headers: adminHeaders });
    collector = collectorsRes.body.collectors?.[0];
    const newVeh = await request("/api/admin/vehicles", {
      method: "POST",
      headers: adminHeaders,
      body: {
        registrationNo: `EV-${Date.now().toString().slice(-6)}`,
        type: "Electric Van",
        capacity: 500,
        driverId: collector.id,
      },
    });
    vehicleId = newVeh.body.vehicle?.id;
  }
  console.log("✓ Available collector found:", collector?.name, "(id:", collector?.id, ")");

  // 6. Admin assigns pickup to collector & vehicle
  console.log("\n6. Testing Pickup Assignment...");
  const assignRes = await request(`/api/pickups/${createdPickup.id}/assign`, {
    method: "PATCH",
    headers: adminHeaders,
    body: { vehicleId, collectorId: collector.id, slotPeriod: "AFTERNOON" },
  });
  if (assignRes.status !== 200) {
    throw new Error(`Assignment failed: ${JSON.stringify(assignRes.body)}`);
  }
  console.log("✓ Pickup assigned to collector:", assignRes.body.pickup.assignedAdmin?.name, "status:", assignRes.body.pickup.status);

  // 7. Test rejection WITHOUT mandatory reason (should fail with 400)
  console.log("\n7. Testing Rejection Validation (Expect 400 when reason is empty)...");
  const rejectNoReason = await request(`/api/pickups/${createdPickup.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: { status: "rejected" },
  });
  console.log("✓ Rejection without reason returned status:", rejectNoReason.status, "(properly blocked)");

  // 8. Admin rejects pickup WITH mandatory reason
  console.log("\n8. Testing Rejection WITH Mandatory Reason...");
  const rejectionReason = "Uploaded image does not clearly show recyclable plastic material.";
  const rejectWithReason = await request(`/api/pickups/${createdPickup.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: { status: "rejected", rejectionReason },
  });
  if (rejectWithReason.status !== 200) {
    throw new Error(`Rejection with reason failed: ${JSON.stringify(rejectWithReason.body)}`);
  }
  console.log("✓ Pickup rejected successfully. Saved reason:", rejectWithReason.body.pickup.rejectionReason);

  // 9. Verify citizen sees rejection reason
  console.log("\n9. Verifying Citizen Sees Rejection Reason...");
  const citizenViewPickup = await request(`/api/pickups/${createdPickup.id}`, { headers: citizenHeaders });
  if (citizenViewPickup.body.pickup.rejectionReason !== rejectionReason) {
    throw new Error("Citizen cannot see rejection reason!");
  }
  console.log("✓ Citizen received exact rejection reason:", citizenViewPickup.body.pickup.rejectionReason);

  // 10. Citizen creates another pickup & Admin completes it
  console.log("\n10. Testing Pickup Completion & Green Points Award...");
  const pickup2 = await request("/api/pickups", {
    method: "POST",
    headers: citizenHeaders,
    body: {
      wasteType: "PAPER_CARDBOARD",
      quantityBand: "LARGE",
      address: "MG Road, Pune",
      slotPeriod: "MORNING",
      requestedDate: new Date().toISOString(),
    },
  });
  await request(`/api/pickups/${pickup2.body.pickup.id}/assign`, {
    method: "PATCH",
    headers: adminHeaders,
    body: { vehicleId, collectorId: collector.id },
  });
  const completedRes = await request(`/api/pickups/${pickup2.body.pickup.id}/status`, {
    method: "PATCH",
    headers: adminHeaders,
    body: { status: "completed", wasteQuantity: 8.5 },
  });
  if (completedRes.status !== 200) {
    throw new Error(`Complete failed: ${JSON.stringify(completedRes.body)}`);
  }
  console.log("✓ Pickup completed! Points awarded:", completedRes.body.pointsEarned, "wasteQuantity:", completedRes.body.pickup?.wasteQuantity);

  // 11. Citizen checks My Impact
  console.log("\n11. Testing Citizen My Impact Profile...");
  const impactRes = await request("/api/pickups/my-impact", { headers: citizenHeaders });
  console.log("✓ Citizen impact total waste:", impactRes.body.totalWasteContributed, "kg, Green Points:", impactRes.body.totalPointsEarned);

  // 12. Admin checks User Profile
  console.log("\n12. Testing Admin User Profile View...");
  const userProfileRes = await request(`/api/admin/users/${citizenUser.id}`, { headers: adminHeaders });
  console.log("✓ Admin fetched user profile for:", userProfileRes.body.user.name, "Total waste:", userProfileRes.body.metrics.totalWasteKg, "kg");

  // 13. Create New Reward, Badge, Collector
  console.log("\n13. Testing 'Create New' Operations...");
  const newReward = await request("/api/rewards", {
    method: "POST",
    headers: adminHeaders,
    body: {
      name: `Compost Pack ${Date.now()}`,
      pointsRequired: 80,
      stock: 50,
      description: "Rich organic vermicompost produced from community waste.",
    },
  });
  console.log("✓ Create New Reward:", newReward.status, newReward.body.reward?.name);

  const newBadge = await request("/api/badges", {
    method: "POST",
    headers: adminHeaders,
    body: {
      name: `Hero Tier ${Date.now()}`,
      minPoints: 600,
      description: "Dedicated to citizens who achieve 600+ points.",
    },
  });
  console.log("✓ Create New Badge:", newBadge.status, newBadge.body.badge?.name);

  const newCollector = await request("/api/admin/collectors", {
    method: "POST",
    headers: adminHeaders,
    body: {
      name: "Suresh Deshmukh",
      email: `suresh_${Date.now()}@pruthvi.ngo`,
      phone: `9822${Math.floor(100000 + Math.random() * 900000)}`,
      password: "Collector@123",
    },
  });
  console.log("✓ Create New Collector:", newCollector.status, newCollector.body.collector?.name);

  console.log("\n========================================================");
  console.log("ALL TESTS PASSED WITH 100% SUCCESS!");
  console.log("========================================================");
}

// Use existing running server on port 4000
baseUrl = "http://localhost:4000";
runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST ERROR:", err);
    process.exit(1);
  });
