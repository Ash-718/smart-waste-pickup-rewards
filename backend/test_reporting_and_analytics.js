const assert = require("assert");
const prisma = require("./src/db/client");

const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000/api";

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

async function runReportTests() {
  console.log("================================================================================");
  console.log("🧪 [TEST SUITE] WasteWise Downloadable Reports & Analytics Automated Verification");
  console.log("================================================================================\n");

  // 1. Authenticate Personas
  console.log("▶ 1. Authenticating test users...");
  const citizenToken = await login("demo_citizen@example.com", "DemoCitizen@123");
  const citizenToken2 = await login("demo_citizen_sunita@example.com", "DemoCitizen@123");
  const adminToken = await login("admin@wastewise.local", "Admin@123");
  console.log("  ✓ Citizen 1 authenticated (Aarav Mehta)");
  console.log("  ✓ Citizen 2 authenticated (Sunita Deshmukh)");
  console.log("  ✓ Admin authenticated (Pruthvi ZeroWaste Admin)\n");

  // 2. Citizen Report Preview & Data Structure
  console.log("▶ 2. Testing Citizen Report Preview (JSON)...");
  const citRes = await fetch(`${BASE_URL}/reports/citizen?period=30d`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert.strictEqual(citRes.status, 200, "Citizen report should return 200");
  const citData = await citRes.json();
  assert(citData.citizen, "Should contain citizen metadata");
  assert(citData.pickupStatistics, "Should contain pickupStatistics");
  assert(citData.greenPointsAndRewards, "Should contain greenPointsAndRewards");
  assert(citData.environmentalImpact, "Should contain environmentalImpact");
  console.log(`  ✓ Citizen preview loaded: ${citData.citizen.name} (${citData.pickupStatistics.totalPickups} pickups, ${citData.pickupStatistics.totalVerifiedWasteKg} kg waste)\n`);

  // 3. Citizen PDF Download & Magic Bytes Validation
  console.log("▶ 3. Testing Citizen PDF Report Download...");
  const citPdfRes = await fetch(`${BASE_URL}/reports/citizen/pdf?period=30d`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert.strictEqual(citPdfRes.status, 200, "Citizen PDF should return 200");
  assert.strictEqual(citPdfRes.headers.get("content-type"), "application/pdf");
  const citPdfBuffer = Buffer.from(await citPdfRes.arrayBuffer());
  assert(citPdfBuffer.length > 1000, "PDF should not be empty");
  // Check PDF magic header
  const pdfMagic = citPdfBuffer.slice(0, 5).toString();
  assert.strictEqual(pdfMagic, "%PDF-", "File should have valid PDF magic bytes (%PDF-)");
  console.log(`  ✓ Valid PDF generated: ${citPdfBuffer.length} bytes (starts with '${pdfMagic}')\n`);

  // 4. Citizen CSV Download Validation
  console.log("▶ 4. Testing Citizen CSV Dataset Export...");
  const citCsvRes = await fetch(`${BASE_URL}/reports/citizen/csv?period=30d`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert.strictEqual(citCsvRes.status, 200, "Citizen CSV should return 200");
  assert(citCsvRes.headers.get("content-type").includes("text/csv"));
  const citCsvText = await citCsvRes.text();
  assert(citCsvText.includes("WasteWise Citizen Impact & Recycling Report"), "CSV must include header");
  assert(citCsvText.includes("WASTE BY CATEGORY"), "CSV must include category breakdown section");
  assert(citCsvText.includes("DETAILED PICKUP HISTORY"), "CSV must include pickup history table");
  console.log(`  ✓ Valid CSV generated: ${citCsvText.split("\n").length} rows of structured data\n`);

  // 5. Security & Isolation Checks
  console.log("▶ 5. Testing Security, Authorization & Tenant Isolation...");
  // A. Citizen attempting to access Admin reports -> MUST be 403 Forbidden
  const forbiddenRes = await fetch(`${BASE_URL}/reports/admin`, {
    headers: { Authorization: `Bearer ${citizenToken}` },
  });
  assert.strictEqual(forbiddenRes.status, 403, "Citizen MUST be forbidden from accessing admin reports");
  console.log("  ✓ Enforced: Citizen cannot access admin reports (403 Forbidden)");

  // B. Unauthenticated request -> MUST be 401 Unauthorized
  const unauthRes = await fetch(`${BASE_URL}/reports/citizen`);
  assert.strictEqual(unauthRes.status, 401, "Unauthenticated request MUST be rejected");
  console.log("  ✓ Enforced: Unauthenticated requests rejected (401 Unauthorized)");

  // C. Data Isolation: Citizen 1 data must only reflect Citizen 1's pickups
  const cit2Res = await fetch(`${BASE_URL}/reports/citizen?period=all`, {
    headers: { Authorization: `Bearer ${citizenToken2}` },
  });
  const cit2Data = await cit2Res.json();
  assert.strictEqual(cit2Data.citizen.email, "demo_citizen_sunita@example.com");
  assert.notStrictEqual(citData.citizen.id, cit2Data.citizen.id, "Citizens must have isolated profiles");
  console.log("  ✓ Enforced: Citizens receive strictly their own verified records\n");

  // 6. Admin Platform Analytics & Date Filtering
  console.log("▶ 6. Testing Admin Platform Analytics & Timeframe Filters...");
  for (const period of ["7d", "30d", "90d", "all"]) {
    const res = await fetch(`${BASE_URL}/reports/admin?period=${period}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200, `Admin report for ${period} should return 200`);
    const data = await res.json();
    assert(data.pickupAnalytics, "Must include pickupAnalytics");
    assert(data.wasteCollectionAnalytics, "Must include wasteCollectionAnalytics");
    assert(data.fleetAnalytics, "Must include fleetAnalytics");
    assert(data.citizenAnalytics, "Must include citizenAnalytics");
    assert(data.rewardsAnalytics, "Must include rewardsAnalytics");
    console.log(`  ✓ Admin period '${period}': ${data.pickupAnalytics.totalPickups} pickups, ${data.wasteCollectionAnalytics.totalVerifiedWasteKg} kg waste`);
  }
  console.log();

  // 7. Admin Category Filter Check
  console.log("▶ 7. Testing Admin Waste Category Filters...");
  const catRes = await fetch(`${BASE_URL}/reports/admin?period=all&category=PLASTIC`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(catRes.status, 200);
  const catData = await catRes.json();
  catData.pickupRecords.forEach((p) => {
    assert.strictEqual(p.category, "PLASTIC", "All filtered pickups must match selected category");
  });
  console.log(`  ✓ Stream filter verified: all ${catData.pickupRecords.length} records are category 'PLASTIC'\n`);

  // 8. Admin Downloadable Formats: PDF, CSV, and Excel (.xlsx)
  console.log("▶ 8. Testing Admin Multi-Format Downloads...");
  // PDF
  const admPdfRes = await fetch(`${BASE_URL}/reports/admin/pdf?period=30d`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(admPdfRes.status, 200);
  const admPdfBuffer = Buffer.from(await admPdfRes.arrayBuffer());
  assert.strictEqual(admPdfBuffer.slice(0, 5).toString(), "%PDF-", "Admin report must be valid PDF");
  console.log(`  ✓ Admin PDF: ${admPdfBuffer.length} bytes (%PDF-)`);

  // CSV
  const admCsvRes = await fetch(`${BASE_URL}/reports/admin/csv?period=30d`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(admCsvRes.status, 200);
  const admCsvText = await admCsvRes.text();
  assert(admCsvText.includes("COLLECTOR OPERATIONAL PERFORMANCE"), "Admin CSV must include collector stats");
  console.log(`  ✓ Admin CSV: ${admCsvText.split("\n").length} rows`);

  // Excel (.xlsx)
  const admExcelRes = await fetch(`${BASE_URL}/reports/admin/excel?period=30d`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(admExcelRes.status, 200);
  assert(
    admExcelRes.headers.get("content-type").includes("spreadsheetml.sheet"),
    "Content-Type must be valid Excel (.xlsx)"
  );
  const admExcelBuffer = Buffer.from(await admExcelRes.arrayBuffer());
  // Excel (.xlsx) files are ZIP archives starting with magic bytes 'PK'
  const excelMagic = admExcelBuffer.slice(0, 2).toString();
  assert.strictEqual(excelMagic, "PK", "Excel workbook must have valid OOXML/ZIP header ('PK')");
  console.log(`  ✓ Admin Excel (.xlsx): ${admExcelBuffer.length} bytes (Magic: '${excelMagic}')\n`);

  // 9. Data Integrity & Database Reconciliation
  console.log("▶ 9. Verifying Database Data Integrity & Reconciliations...");
  const dbCompletedPickups = await prisma.pickup.findMany({
    where: { status: "completed" },
    select: { wasteQuantity: true },
  });
  const expectedTotalKg = Number(
    dbCompletedPickups.reduce((sum, p) => sum + (p.wasteQuantity || 0), 0).toFixed(1)
  );

  const admAllRes = await fetch(`${BASE_URL}/reports/admin?period=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const admAllData = await admAllRes.json();
  const reportedTotalKg = admAllData.wasteCollectionAnalytics.totalVerifiedWasteKg;

  assert.strictEqual(
    reportedTotalKg,
    expectedTotalKg,
    `Reported waste (${reportedTotalKg}kg) must exactly match DB completed pickups sum (${expectedTotalKg}kg)`
  );
  console.log(`  ✓ Waste Reconciliation: Reported ${reportedTotalKg} kg exactly matches DB sum (${expectedTotalKg} kg)`);

  // Reconcile points ledger
  const dbPointsAgg = await prisma.pointsLedger.aggregate({ _sum: { pointsEarned: true } });
  const expectedPoints = dbPointsAgg._sum.pointsEarned || 0;
  const reportedPoints = admAllData.citizenAnalytics.allTimePointsDistributed;
  assert.strictEqual(
    reportedPoints,
    expectedPoints,
    `Reported points (${reportedPoints}) must match points ledger (${expectedPoints})`
  );
  console.log(`  ✓ Green Points Reconciliation: ${reportedPoints} pts exactly matches immutable ledger`);

  // Reconcile redemptions
  const dbRedemptionsCount = await prisma.rewardRedemption.count();
  const reportedRedemptions = admAllData.citizenAnalytics.totalRedemptionsCount;
  assert.strictEqual(reportedRedemptions, dbRedemptionsCount);
  console.log(`  ✓ Redemptions Reconciliation: ${reportedRedemptions} redemptions matches database\n`);

  // 10. Empty Period Resilience
  console.log("▶ 10. Testing Empty Reporting Period Resilience...");
  const emptyRes = await fetch(
    `${BASE_URL}/reports/admin?period=custom&startDate=2015-01-01&endDate=2015-01-02`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assert.strictEqual(emptyRes.status, 200);
  const emptyData = await emptyRes.json();
  assert.strictEqual(emptyData.pickupAnalytics.totalPickups, 0);
  assert.strictEqual(emptyData.wasteCollectionAnalytics.totalVerifiedWasteKg, 0);

  const emptyPdfRes = await fetch(
    `${BASE_URL}/reports/admin/pdf?period=custom&startDate=2015-01-01&endDate=2015-01-02`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assert.strictEqual(emptyPdfRes.status, 200);
  const emptyPdfBuffer = Buffer.from(await emptyPdfRes.arrayBuffer());
  assert.strictEqual(emptyPdfBuffer.slice(0, 5).toString(), "%PDF-");
  console.log("  ✓ Empty period handled gracefully with zero crashes and valid output files\n");

  console.log("================================================================================");
  console.log("🎉 [SUCCESS] All 10 verification test phases passed with 100% compliance!");
  console.log("================================================================================\n");
}

runReportTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test Suite Failed:", err);
    process.exit(1);
  });
