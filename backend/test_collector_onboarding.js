const BASE_URL = "http://localhost:4000";

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("=== Testing Driver / Collector Onboarding & Login System ===\n");

  const timestamp = Date.now();
  const testApplicant = {
    name: "Vikram Sharma",
    email: `vikram.collector.${timestamp}@example.com`,
    phone: `+9198${String(timestamp).slice(-8)}`,
    password: "Password@123",
    address: "742 Evergreen Terrace, Sector 14, Gurugram, Haryana",
    licenseNumber: `DL-04${String(timestamp).slice(-6)}`,
    vehicleTypePref: "electric_van",
  };

  let adminToken = "";
  let applicationId = "";
  let vehicleId = "";
  let collectorToken = "";

  // 1. Admin login to get adminToken
  console.log("1. Authenticating as Admin...");
  const adminRes = await api("/api/auth/login", {
    method: "POST",
    body: { email: "admin@wastewise.local", password: "Admin@123" },
  });
  if (!adminRes.ok) {
    console.error("   Failed to log in as admin:", adminRes.data);
    process.exit(1);
  }
  adminToken = adminRes.data.token;
  console.log("   Admin authenticated successfully.");

  // 2. Register new collector application
  console.log("\n2. Submitting collector application via POST /api/collector-applications/apply...");
  const appRes = await api("/api/collector-applications/apply", {
    method: "POST",
    body: testApplicant,
  });
  console.log("   Response status:", appRes.status);
  console.log("   Application ID:", appRes.data.application?.id);
  console.log("   Status:", appRes.data.application?.status);
  if (appRes.data.application?.status !== "pending") {
    console.error("   Failed: Expected pending status, got:", appRes.data);
    process.exit(1);
  }
  applicationId = appRes.data.application.id;

  // 3. Attempt to log in with pending application credentials
  console.log("\n3. Testing pending application login restrictions...");
  const pendingLoginRes = await api("/api/auth/login", {
    method: "POST",
    body: { email: testApplicant.email, password: testApplicant.password },
  });
  if (pendingLoginRes.status === 403 && pendingLoginRes.data.error?.includes("under review")) {
    console.log("   Correctly blocked login with 403:", pendingLoginRes.data.error);
  } else {
    console.error("   Security failure: Unexpected login response for pending applicant:", pendingLoginRes);
    process.exit(1);
  }

  // 4. Check application status via public endpoint
  console.log("\n4. Checking application status via GET /api/collector-applications/status...");
  const statusRes = await api(`/api/collector-applications/status?query=${encodeURIComponent(testApplicant.email)}`);
  if (!statusRes.ok || statusRes.data.application?.status !== "pending") {
    console.error("   Status check failed:", statusRes.data);
    process.exit(1);
  }
  console.log("   Status check success:", statusRes.data.application?.status);

  // 5. Admin lists applications
  console.log("\n5. Admin listing applications via GET /api/admin/collector-applications...");
  const listRes = await api("/api/admin/collector-applications?status=pending", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!listRes.ok) {
    console.error("   Admin list failed:", listRes.data);
    process.exit(1);
  }
  const found = listRes.data.applications?.find((a) => a.id === applicationId);
  if (!found) {
    console.error("   Application not found in admin pending list!");
    process.exit(1);
  }
  console.log(`   Found ${listRes.data.applications.length} pending applications. Verified new application exists.`);

  // 6. Admin rejects application with a reason
  console.log("\n6. Testing admin rejection with reason...");
  const rejectRes = await api(`/api/admin/collector-applications/${applicationId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { reason: "Commercial driving license verification photo unclear." },
  });
  if (!rejectRes.ok || rejectRes.data.application?.status !== "rejected") {
    console.error("   Admin rejection failed:", rejectRes.data);
    process.exit(1);
  }
  console.log("   Rejection status:", rejectRes.data.application?.status);
  console.log("   Rejection reason:", rejectRes.data.application?.rejectionReason);

  // 7. Test login after rejection -> should receive 403 with rejection reason
  console.log("\n7. Testing rejected application login restrictions...");
  const rejectedLoginRes = await api("/api/auth/login", {
    method: "POST",
    body: { email: testApplicant.email, password: testApplicant.password },
  });
  if (rejectedLoginRes.status === 403 && rejectedLoginRes.data.error?.includes("rejected")) {
    console.log("   Correctly blocked login with rejection reason:", rejectedLoginRes.data.error);
  } else {
    console.error("   Security failure: Unexpected response for rejected applicant:", rejectedLoginRes);
    process.exit(1);
  }

  // 8. Re-apply / update application
  console.log("\n8. Re-submitting updated application...");
  const reapplyRes = await api("/api/collector-applications/apply", {
    method: "POST",
    body: {
      ...testApplicant,
      licenseNumber: `DL-VERIFIED-${String(timestamp).slice(-4)}`,
    },
  });
  if (!reapplyRes.ok || reapplyRes.data.application?.status !== "pending") {
    console.error("   Re-application failed:", reapplyRes.data);
    process.exit(1);
  }
  console.log("   Re-application success! Status reset to pending.");

  // 9. Find an available vehicle to assign
  console.log("\n9. Finding available fleet vehicle for assignment...");
  const vehiclesRes = await api("/api/admin/vehicles", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (vehiclesRes.ok && vehiclesRes.data.vehicles?.length > 0) {
    vehicleId = vehiclesRes.data.vehicles[0].id;
    console.log(`   Selected vehicle: ${vehiclesRes.data.vehicles[0].registrationNo} (${vehiclesRes.data.vehicles[0].type})`);
  }

  // 10. Admin approves application with vehicle assignment
  console.log("\n10. Testing admin approval with vehicle assignment...");
  const approveRes = await api(`/api/admin/collector-applications/${applicationId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { vehicleId: vehicleId || undefined },
  });
  if (!approveRes.ok || approveRes.data.user?.role !== "collector") {
    console.error("   Admin approval failed:", approveRes.data);
    process.exit(1);
  }
  console.log("   Approval message:", approveRes.data.message);
  console.log("   Activated user role:", approveRes.data.user?.role);
  console.log("   Application status:", approveRes.data.application?.status);

  // 11. Approved collector logs in via /api/auth/login
  console.log("\n11. Testing approved collector login...");
  const loginRes = await api("/api/auth/login", {
    method: "POST",
    body: { email: testApplicant.email, password: testApplicant.password },
  });
  if (!loginRes.ok || loginRes.data.user?.role !== "collector") {
    console.error("   Approved collector login failed:", loginRes.data);
    process.exit(1);
  }
  collectorToken = loginRes.data.token;
  console.log("   Collector login successful!");
  console.log("   User role in JWT payload / response:", loginRes.data.user?.role);

  // 12. Collector accesses driver dashboard endpoints
  console.log("\n12. Accessing Driver Dashboard endpoints (/api/driver/pickups)...");
  const driverRes = await api("/api/driver/pickups", {
    headers: { Authorization: `Bearer ${collectorToken}` },
  });
  if (!driverRes.ok) {
    console.error("   Driver dashboard request failed:", driverRes.data);
    process.exit(1);
  }
  console.log("   Driver profile returned:", driverRes.data.driver?.name);
  console.log("   Assigned vehicle:", driverRes.data.vehicle?.registrationNo || "None");
  console.log("   Active pickups count:", driverRes.data.pickups?.length);
  console.log("   Completed history count:", driverRes.data.history?.length);

  console.log("\n ALL 12 BACKEND ONBOARDING & LOGIN TESTS PASSED SUCCESSFULLY!\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
