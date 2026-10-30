const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/**
 * Generates a clean, professionally formatted Citizen Impact PDF report.
 */
function generateCitizenPdf(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const citizen = reportData.citizen;
      const period = reportData.reportingPeriod;
      const stats = reportData.pickupStatistics;
      const points = reportData.greenPointsAndRewards;
      const impact = reportData.environmentalImpact;

      // Primary Brand Colors
      const primaryColor = "#047857"; // Emerald 700
      const secondaryColor = "#0f172a"; // Slate 900
      const mutedColor = "#64748b"; // Slate 500
      const accentBg = "#f0fdf4"; // Emerald 50

      // --- Header Banner ---
      doc.rect(40, 40, 515, 60).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("WasteWise EcoImpact Report", 55, 52);
      doc.fontSize(9).font("Helvetica").fillColor("#d1fae5").text("Verified Citizen Circular Waste & Recycling Summary", 55, 74);
      doc.fontSize(8).font("Helvetica").text(`Report ID: WW-CIT-${citizen.id.slice(0, 8).toUpperCase()}`, 380, 54, { align: "right", width: 160 });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 380, 68, { align: "right", width: 160 });

      doc.moveDown(2.5);

      // --- Citizen Profile & Period Meta ---
      let y = 115;
      doc.roundedRect(40, y, 515, 50, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(10).font("Helvetica-Bold").text(citizen.name, 55, y + 10);
      doc.fontSize(8).font("Helvetica").fillColor(mutedColor).text(`Email: ${citizen.email}  |  Phone: ${citizen.phone || "N/A"}`, 55, y + 26);
      doc.text(`Member Since: ${citizen.memberSince}`, 55, y + 36);

      doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold").text(`Period: ${period.label}`, 340, y + 10, { align: "right", width: 200 });
      doc.fontSize(8).font("Helvetica").fillColor(mutedColor).text(`From: ${period.startDate} to ${period.endDate}`, 340, y + 26, { align: "right", width: 200 });
      doc.text(`Points Balance: ${citizen.currentPointsBalance} pts`, 340, y + 36, { align: "right", width: 200 });

      // --- Key Performance Indicator Cards ---
      y = 175;
      const cardWidth = 120;
      const cardHeight = 55;
      const cards = [
        { label: "Waste Recycled", val: `${stats.totalVerifiedWasteKg} kg`, sub: "Verified Diverted" },
        { label: "Completed Pickups", val: `${stats.completedPickups}`, sub: `${stats.completionRate}% Success Rate` },
        { label: "Points Earned", val: `+${points.pointsEarnedInPeriod}`, sub: `${points.totalAllTimePointsEarned} All-Time` },
        { label: "Landfill Diversion", val: `${impact.landfillDiversionKg} kg`, sub: "100% Diverted" },
      ];

      cards.forEach((c, i) => {
        const cx = 40 + i * (cardWidth + 11);
        doc.roundedRect(cx, y, cardWidth, cardHeight, 6).fillAndStroke(accentBg, "#bbf7d0");
        doc.fillColor(mutedColor).fontSize(7.5).font("Helvetica-Bold").text(c.label.toUpperCase(), cx + 8, y + 8);
        doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text(c.val, cx + 8, y + 22);
        doc.fillColor(secondaryColor).fontSize(7).font("Helvetica").text(c.sub, cx + 8, y + 40);
      });

      // --- Section 1: Waste by Category ---
      y = 245;
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("1. Verified Waste Collection by Stream", 40, y);
      y += 18;

      // Table Header
      doc.rect(40, y, 515, 20).fill("#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("Waste Category", 50, y + 6);
      doc.text("Pickups", 260, y + 6, { align: "right", width: 50 });
      doc.text("Verified Weight (kg)", 340, y + 6, { align: "right", width: 90 });
      doc.text("Share of Total", 450, y + 6, { align: "right", width: 80 });
      y += 20;

      stats.wasteByCategory.forEach((cat, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, y, 515, 18).fill(bg);
        doc.fillColor(secondaryColor).fontSize(8).font("Helvetica");
        doc.text(cat.label, 50, y + 5);
        doc.text(`${cat.count}`, 260, y + 5, { align: "right", width: 50 });
        doc.text(`${cat.verifiedKg} kg`, 340, y + 5, { align: "right", width: 90 });
        doc.text(`${cat.percentage}%`, 450, y + 5, { align: "right", width: 80 });
        y += 18;
      });

      // --- Section 2: Environmental Impact Analysis ---
      y += 15;
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("2. Verified Environmental Contribution", 40, y);
      y += 18;
      doc.roundedRect(40, y, 515, 52, 6).fillAndStroke("#f1f5f9", "#cbd5e1");
      doc.fillColor(secondaryColor).fontSize(8.5).font("Helvetica");
      doc.text(
        `• Municipal Landfill Diversion: Exactly ${impact.landfillDiversionKg} kg of verified post-consumer recyclables were diverted from open municipal dumpsites into formal circular recovery channels.\n` +
        `• Material Streams Processed: ${impact.streamsDiverted.map((s) => `${s.stream} (${s.weightKg} kg)`).join(", ") || "No completed streams in this period"}.\n` +
        `• Citizen Reliability Rating: ${impact.civicIndex.reliableRecyclerRating} with ${stats.completedPickups} completed pickups in this reporting cycle.`,
        50,
        y + 8,
        { width: 495, lineGap: 3 }
      );
      y += 65;

      // --- Section 3: Detailed Pickup Log ---
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("3. Pickup Activity History", 40, y);
      y += 18;

      // Table Header
      doc.rect(40, y, 515, 20).fill("#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("Date", 50, y + 6);
      doc.text("Category", 110, y + 6);
      doc.text("Quantity Band", 210, y + 6);
      doc.text("Weight", 290, y + 6);
      doc.text("Status", 350, y + 6);
      doc.text("Points", 410, y + 6);
      doc.text("Assigned Vehicle", 460, y + 6);
      y += 20;

      const historyRows = stats.pickupHistory.slice(0, 15);
      if (historyRows.length === 0) {
        doc.rect(40, y, 515, 20).fill("#ffffff");
        doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text("No pickup requests recorded for this reporting period.", 50, y + 6);
        y += 20;
      } else {
        historyRows.forEach((row, idx) => {
          if (y > 720) {
            doc.addPage();
            y = 40;
          }
          const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
          doc.rect(40, y, 515, 18).fill(bg);
          doc.fillColor(secondaryColor).fontSize(7.5).font("Helvetica");
          doc.text(row.date, 50, y + 5);
          doc.text(row.categoryLabel, 110, y + 5, { width: 95, lineBreak: false });
          doc.text(row.quantityBand, 210, y + 5);
          doc.text(row.wasteQuantityKg !== null ? `${row.wasteQuantityKg} kg` : "Pending", 290, y + 5);
          doc.text(row.status.toUpperCase(), 350, y + 5);
          doc.text(row.pointsEarned ? `+${row.pointsEarned}` : "0", 410, y + 5);
          doc.text(row.assignedVehicle || "—", 460, y + 5);
          y += 18;
        });
      }

      // --- Section 4: Points & Rewards Summary ---
      if (y > 680) {
        doc.addPage();
        y = 40;
      } else {
        y += 15;
      }

      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("4. Green Points & Rewards Engagement", 40, y);
      y += 16;

      const badgesText = points.badgesUnlocked.length > 0
        ? points.badgesUnlocked.map((b) => `${b.name} (${b.earnedAt})`).join(", ")
        : "No badges earned yet. Complete pickups to unlock.";

      const redemptionsText = points.rewardsRedeemedHistory.length > 0
        ? points.rewardsRedeemedHistory.map((r) => `${r.rewardName} (${r.pointsSpent} pts on ${r.redeemedAt})`).join(", ")
        : "No reward redemptions recorded in this timeframe.";

      doc.roundedRect(40, y, 515, 45, 6).fillAndStroke("#f8fafc", "#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica");
      doc.text(`• Badges Unlocked: ${badgesText}`, 50, y + 8, { width: 495 });
      doc.text(`• Rewards Redeemed: ${redemptionsText}`, 50, y + 24, { width: 495 });

      // Add Page Numbers
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fillColor(mutedColor).fontSize(7.5).font("Helvetica").text(
          `WasteWise Smart Waste Platform  •  Page ${i + 1} of ${totalPages}  •  Environmental Verification & Impact Report`,
          40,
          780,
          { align: "center", width: 515 }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an Executive Municipal Waste & Fleet Analytics PDF for Administrators.
 */
function generateAdminPdf(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const period = reportData.reportingPeriod;
      const pickup = reportData.pickupAnalytics;
      const waste = reportData.wasteCollectionAnalytics;
      const fleet = reportData.fleetAnalytics;
      const citizen = reportData.citizenAnalytics;
      const rewards = reportData.rewardsAnalytics;

      const primaryColor = "#065f46"; // Emerald 800
      const secondaryColor = "#0f172a";
      const mutedColor = "#64748b";
      const accentBg = "#f0fdf4";

      // Header Banner
      doc.rect(40, 40, 515, 60).fill(primaryColor);
      doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("WasteWise Platform Analytics", 55, 52);
      doc.fontSize(9).font("Helvetica").fillColor("#d1fae5").text("Executive Operations, Fleet & Waste Diversion Report", 55, 74);
      doc.fontSize(8).font("Helvetica").text(`Report Period: ${period.label}`, 360, 54, { align: "right", width: 180 });
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 360, 68, { align: "right", width: 180 });

      // Executive KPI Cards
      let y = 115;
      const cardWidth = 98;
      const cardHeight = 55;
      const cards = [
        { label: "Total Pickups", val: `${pickup.totalPickups}`, sub: `${pickup.completionRate}% Completion` },
        { label: "Waste Collected", val: `${waste.totalVerifiedWasteKg} kg`, sub: "Verified Diverted" },
        { label: "Fleet Vehicles", val: `${fleet.totalVehicles}`, sub: `${fleet.activeVehiclesCount} Active` },
        { label: "Active Citizens", val: `${citizen.activeCitizensCount}`, sub: `of ${citizen.totalRegisteredCitizens} Reg.` },
        { label: "Points Issued", val: `+${citizen.pointsDistributedInPeriod}`, sub: `${citizen.totalRedemptionsCount} Redemptions` },
      ];

      cards.forEach((c, i) => {
        const cx = 40 + i * (cardWidth + 6);
        doc.roundedRect(cx, y, cardWidth, cardHeight, 6).fillAndStroke(accentBg, "#a7f3d0");
        doc.fillColor(mutedColor).fontSize(7).font("Helvetica-Bold").text(c.label.toUpperCase(), cx + 6, y + 8);
        doc.fillColor(primaryColor).fontSize(13).font("Helvetica-Bold").text(c.val, cx + 6, y + 22);
        doc.fillColor(secondaryColor).fontSize(6.5).font("Helvetica").text(c.sub, cx + 6, y + 40);
      });

      // Section A: Pickup Status Breakdown
      y = 185;
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("A. Municipal Pickup Queue Performance", 40, y);
      y += 16;

      doc.rect(40, y, 515, 20).fill("#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("Metric / Status", 50, y + 6);
      doc.text("Count", 250, y + 6, { align: "right", width: 70 });
      doc.text("Share (%)", 380, y + 6, { align: "right", width: 70 });
      y += 20;

      const statusRows = [
        { label: "Completed Pickups", count: pickup.completedPickups, pct: pickup.totalPickups > 0 ? ((pickup.completedPickups / pickup.totalPickups) * 100).toFixed(1) : 0 },
        { label: "Pending (Requested / In-Transit)", count: pickup.pendingPickups, pct: pickup.totalPickups > 0 ? ((pickup.pendingPickups / pickup.totalPickups) * 100).toFixed(1) : 0 },
        { label: "Cancelled by Citizen", count: pickup.cancelledPickups, pct: pickup.totalPickups > 0 ? ((pickup.cancelledPickups / pickup.totalPickups) * 100).toFixed(1) : 0 },
        { label: "Rejected by Staff", count: pickup.rejectedPickups, pct: pickup.totalPickups > 0 ? ((pickup.rejectedPickups / pickup.totalPickups) * 100).toFixed(1) : 0 },
      ];

      statusRows.forEach((r, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, y, 515, 17).fill(bg);
        doc.fillColor(secondaryColor).fontSize(8).font("Helvetica");
        doc.text(r.label, 50, y + 5);
        doc.text(`${r.count}`, 250, y + 5, { align: "right", width: 70 });
        doc.text(`${r.pct}%`, 380, y + 5, { align: "right", width: 70 });
        y += 17;
      });

      // Section B: Waste Stream Material Recovery
      y += 15;
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("B. Waste Recovery by Material Category", 40, y);
      y += 16;

      doc.rect(40, y, 515, 20).fill("#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("Category", 50, y + 6);
      doc.text("Pickup Count", 230, y + 6, { align: "right", width: 70 });
      doc.text("Verified Weight (kg)", 330, y + 6, { align: "right", width: 90 });
      doc.text("Composition (%)", 450, y + 6, { align: "right", width: 80 });
      y += 20;

      waste.wasteByCategory.forEach((cat, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, y, 515, 17).fill(bg);
        doc.fillColor(secondaryColor).fontSize(8).font("Helvetica");
        doc.text(cat.label, 50, y + 5);
        doc.text(`${cat.count}`, 230, y + 5, { align: "right", width: 70 });
        doc.text(`${cat.verifiedKg} kg`, 330, y + 5, { align: "right", width: 90 });
        doc.text(`${cat.percentage}%`, 450, y + 5, { align: "right", width: 80 });
        y += 17;
      });

      // Section C: Collector Fleet Performance
      y += 15;
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("C. Collector Operational Performance", 40, y);
      y += 16;

      doc.rect(40, y, 515, 20).fill("#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("Collector Name", 50, y + 6);
      doc.text("Vehicle Reg", 190, y + 6);
      doc.text("Assigned", 280, y + 6, { align: "right", width: 60 });
      doc.text("Completed", 360, y + 6, { align: "right", width: 60 });
      doc.text("Total Waste (kg)", 440, y + 6, { align: "right", width: 90 });
      y += 20;

      if (waste.collectorPerformance.length === 0) {
        doc.rect(40, y, 515, 18).fill("#ffffff");
        doc.fillColor(mutedColor).fontSize(8).font("Helvetica").text("No collector activity recorded in this period.", 50, y + 5);
        y += 18;
      } else {
        waste.collectorPerformance.forEach((col, idx) => {
          const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
          doc.rect(40, y, 515, 17).fill(bg);
          doc.fillColor(secondaryColor).fontSize(8).font("Helvetica");
          doc.text(col.name, 50, y + 5);
          doc.text(col.vehicleReg, 190, y + 5);
          doc.text(`${col.assignedPickupsCount}`, 280, y + 5, { align: "right", width: 60 });
          doc.text(`${col.completedPickupsCount}`, 360, y + 5, { align: "right", width: 60 });
          doc.text(`${col.totalWasteCollectedKg} kg`, 440, y + 5, { align: "right", width: 90 });
          y += 17;
        });
      }

      // Page 2: Fleet Roster & Rewards Analytics
      doc.addPage();
      y = 40;

      // Section D: Fleet Vehicles & Utilization
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("D. Fleet Assets & Utilization", 40, y);
      y += 16;

      doc.rect(40, y, 515, 20).fill("#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("Reg Number", 50, y + 6);
      doc.text("Vehicle Type", 150, y + 6);
      doc.text("Capacity", 250, y + 6);
      doc.text("Assigned Collector", 330, y + 6);
      doc.text("Status", 470, y + 6);
      y += 20;

      fleet.fleetRoster.forEach((veh, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, y, 515, 17).fill(bg);
        doc.fillColor(secondaryColor).fontSize(8).font("Helvetica");
        doc.text(veh.registrationNo, 50, y + 5);
        doc.text(veh.type, 150, y + 5);
        doc.text(`${veh.capacityKg} kg`, 250, y + 5);
        doc.text(veh.collectorName, 330, y + 5);
        doc.text(veh.isActive ? "Active" : "Inactive", 470, y + 5);
        y += 17;
      });

      // Section E: Rewards & Incentive Redemption
      y += 20;
      doc.fillColor(secondaryColor).fontSize(11).font("Helvetica-Bold").text("E. Citizen Incentive & Reward Catalogue", 40, y);
      y += 16;

      doc.rect(40, y, 515, 20).fill("#e2e8f0");
      doc.fillColor(secondaryColor).fontSize(8).font("Helvetica-Bold");
      doc.text("Reward Item", 50, y + 6);
      doc.text("Points Required", 230, y + 6, { align: "right", width: 80 });
      doc.text("Current Stock", 340, y + 6, { align: "right", width: 70 });
      doc.text("Total Redemptions", 430, y + 6, { align: "right", width: 90 });
      y += 20;

      rewards.rewardCatalogue.forEach((rew, idx) => {
        const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(40, y, 515, 17).fill(bg);
        doc.fillColor(secondaryColor).fontSize(8).font("Helvetica");
        doc.text(rew.name, 50, y + 5);
        doc.text(`${rew.pointsRequired} pts`, 230, y + 5, { align: "right", width: 80 });
        doc.text(`${rew.stock}`, 340, y + 5, { align: "right", width: 70 });
        doc.text(`${rew.redemptionsCount}`, 430, y + 5, { align: "right", width: 90 });
        y += 17;
      });

      // Footers
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fillColor(mutedColor).fontSize(7.5).font("Helvetica").text(
          `WasteWise Executive Analytics  •  Page ${i + 1} of ${totalPages}  •  Pruthvi ZeroWaste Platform`,
          40,
          780,
          { align: "center", width: 515 }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates structured CSV for Citizen Personal Reports.
 */
function generateCitizenCsv(reportData) {
  const citizen = reportData.citizen;
  const stats = reportData.pickupStatistics;
  const lines = [];

  lines.push("WasteWise Citizen Impact & Recycling Report");
  lines.push(`Citizen Name,${citizen.name}`);
  lines.push(`Email,${citizen.email}`);
  lines.push(`Reporting Period,${reportData.reportingPeriod.label}`);
  lines.push(`Generated At,${reportData.reportingPeriod.generatedAt}`);
  lines.push("");

  lines.push("SUMMARY METRICS");
  lines.push("Metric,Value");
  lines.push(`Total Pickups,${stats.totalPickups}`);
  lines.push(`Completed Pickups,${stats.completedPickups}`);
  lines.push(`Completion Rate (%),${stats.completionRate}`);
  lines.push(`Total Verified Waste Recycled (kg),${stats.totalVerifiedWasteKg}`);
  lines.push(`Green Points Earned (in period),${reportData.greenPointsAndRewards.pointsEarnedInPeriod}`);
  lines.push(`Current Available Points Balance,${citizen.currentPointsBalance}`);
  lines.push("");

  lines.push("WASTE BY CATEGORY");
  lines.push("Category Code,Category Name,Pickups Count,Verified Weight (kg),Percentage (%)");
  stats.wasteByCategory.forEach((cat) => {
    lines.push(`"${cat.category}","${cat.label}",${cat.count},${cat.verifiedKg},${cat.percentage}`);
  });
  lines.push("");

  lines.push("DETAILED PICKUP HISTORY");
  lines.push("Pickup ID,Date,Category,Quantity Band,Verified Weight (kg),Status,Assigned Vehicle,Points Earned,Address");
  stats.pickupHistory.forEach((p) => {
    lines.push(
      `"${p.id}","${p.date}","${p.categoryLabel}","${p.quantityBand}",${p.wasteQuantityKg !== null ? p.wasteQuantityKg : ""},"${p.status}","${p.assignedVehicle || ""}","${p.pointsEarned}","${(p.address || "").replace(/"/g, '""')}"`
    );
  });

  return lines.join("\n");
}

/**
 * Generates structured CSV for Administrator Platform Reports.
 */
function generateAdminCsv(reportData) {
  const period = reportData.reportingPeriod;
  const pickup = reportData.pickupAnalytics;
  const waste = reportData.wasteCollectionAnalytics;
  const fleet = reportData.fleetAnalytics;
  const citizen = reportData.citizenAnalytics;
  const lines = [];

  lines.push("WasteWise Executive Municipal Platform Report");
  lines.push(`Reporting Period,${period.label}`);
  lines.push(`Generated At,${period.generatedAt}`);
  lines.push("");

  lines.push("PLATFORM KPI SUMMARY");
  lines.push("Metric,Value");
  lines.push(`Total Pickups,${pickup.totalPickups}`);
  lines.push(`Completed Pickups,${pickup.completedPickups}`);
  lines.push(`Completion Rate (%),${pickup.completionRate}`);
  lines.push(`Total Waste Collected (kg),${waste.totalVerifiedWasteKg}`);
  lines.push(`Total Registered Citizens,${citizen.totalRegisteredCitizens}`);
  lines.push(`Active Citizens in Period,${citizen.activeCitizensCount}`);
  lines.push(`Total Vehicles,${fleet.totalVehicles}`);
  lines.push(`Active Vehicles,${fleet.activeVehiclesCount}`);
  lines.push(`Fleet Utilization Rate (%),${fleet.fleetUtilizationRate}`);
  lines.push("");

  lines.push("WASTE COLLECTION BY STREAM");
  lines.push("Category Code,Category Name,Pickups Count,Verified Weight (kg),Percentage (%)");
  waste.wasteByCategory.forEach((cat) => {
    lines.push(`"${cat.category}","${cat.label}",${cat.count},${cat.verifiedKg},${cat.percentage}`);
  });
  lines.push("");

  lines.push("COLLECTOR OPERATIONAL PERFORMANCE");
  lines.push("Collector ID,Name,Email,Assigned Vehicle,Assigned Pickups,Completed Pickups,Total Waste (kg),Success Rate (%)");
  waste.collectorPerformance.forEach((c) => {
    lines.push(`"${c.collectorId}","${c.name}","${c.email}","${c.vehicleReg}",${c.assignedPickupsCount},${c.completedPickupsCount},${c.totalWasteCollectedKg},${c.successRate}`);
  });
  lines.push("");

  lines.push("PICKUP RECORDS");
  lines.push("Pickup ID,Date,Citizen Name,Citizen Phone,Category,Quantity Band,Verified Weight (kg),Status,Assigned Vehicle,Collector Name,Address");
  reportData.pickupRecords.forEach((p) => {
    lines.push(
      `"${p.id}","${p.date}","${p.citizenName}","${p.citizenPhone}","${p.categoryLabel}","${p.quantityBand}",${p.wasteQuantityKg !== null ? p.wasteQuantityKg : ""},"${p.status}","${p.vehicleReg}","${p.collectorName}","${(p.address || "").replace(/"/g, '""')}"`
    );
  });

  return lines.join("\n");
}

/**
 * Generates a multi-worksheet Excel (.xlsx) workbook for Administrators.
 */
async function generateAdminExcel(reportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WasteWise System";
  workbook.created = new Date();

  const period = reportData.reportingPeriod;
  const pickup = reportData.pickupAnalytics;
  const waste = reportData.wasteCollectionAnalytics;
  const fleet = reportData.fleetAnalytics;
  const citizen = reportData.citizenAnalytics;
  const rewards = reportData.rewardsAnalytics;

  // Helper to format header rows
  const styleHeaderRow = (row) => {
    row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF065F46" }, // Dark Emerald
    };
    row.alignment = { vertical: "middle", horizontal: "left" };
  };

  // --- Sheet 1: Overview ---
  const wsOverview = workbook.addWorksheet("Overview");
  wsOverview.columns = [
    { header: "Metric", key: "metric", width: 35 },
    { header: "Value", key: "value", width: 25 },
    { header: "Notes", key: "notes", width: 35 },
  ];
  styleHeaderRow(wsOverview.getRow(1));

  wsOverview.addRows([
    { metric: "Reporting Period", value: period.label, notes: `From ${period.startDate} to ${period.endDate}` },
    { metric: "Total Pickups", value: pickup.totalPickups, notes: "All statuses in period" },
    { metric: "Completed Pickups", value: pickup.completedPickups, notes: `${pickup.completionRate}% completion rate` },
    { metric: "Pending Pickups", value: pickup.pendingPickups, notes: "Requested, assigned, or on the way" },
    { metric: "Cancelled Pickups", value: pickup.cancelledPickups, notes: "Cancelled by citizen" },
    { metric: "Rejected Pickups", value: pickup.rejectedPickups, notes: "Rejected by operational staff" },
    { metric: "Total Verified Waste (kg)", value: waste.totalVerifiedWasteKg, notes: "Diverted from municipal landfills" },
    { metric: "Registered Citizens", value: citizen.totalRegisteredCitizens, notes: "Platform total" },
    { metric: "Active Citizens in Period", value: citizen.activeCitizensCount, notes: `${citizen.citizenParticipationRate}% participation` },
    { metric: "Total Vehicles", value: fleet.totalVehicles, notes: `${fleet.activeVehiclesCount} active vehicles` },
    { metric: "Fleet Utilization Rate", value: `${fleet.fleetUtilizationRate}%`, notes: "Vehicles with active driver assignments" },
    { metric: "Green Points Issued", value: citizen.pointsDistributedInPeriod, notes: "In selected period" },
    { metric: "Points Redeemed", value: citizen.totalPointsRedeemed, notes: `${citizen.totalRedemptionsCount} redemptions` },
  ]);

  // --- Sheet 2: Pickup Analytics ---
  const wsPickups = workbook.addWorksheet("Pickup Analytics");
  wsPickups.columns = [
    { header: "Pickup ID", key: "id", width: 20 },
    { header: "Date", key: "date", width: 12 },
    { header: "Citizen", key: "citizen", width: 22 },
    { header: "Category", key: "category", width: 20 },
    { header: "Quantity Band", key: "band", width: 15 },
    { header: "Weight (kg)", key: "weight", width: 14 },
    { header: "Status", key: "status", width: 15 },
    { header: "Vehicle", key: "vehicle", width: 16 },
    { header: "Collector", key: "collector", width: 22 },
    { header: "Address", key: "address", width: 40 },
  ];
  styleHeaderRow(wsPickups.getRow(1));

  reportData.pickupRecords.forEach((p) => {
    wsPickups.addRow({
      id: p.id,
      date: p.date,
      citizen: p.citizenName,
      category: p.categoryLabel,
      band: p.quantityBand,
      weight: p.wasteQuantityKg !== null ? p.wasteQuantityKg : "—",
      status: p.status.toUpperCase(),
      vehicle: p.vehicleReg,
      collector: p.collectorName,
      address: p.address,
    });
  });

  // --- Sheet 3: Waste Collection ---
  const wsWaste = workbook.addWorksheet("Waste Collection");
  wsWaste.columns = [
    { header: "Category Code", key: "code", width: 22 },
    { header: "Category Name", key: "name", width: 24 },
    { header: "Pickups Count", key: "count", width: 16 },
    { header: "Verified Weight (kg)", key: "weight", width: 22 },
    { header: "Share (%)", key: "pct", width: 14 },
  ];
  styleHeaderRow(wsWaste.getRow(1));

  waste.wasteByCategory.forEach((cat) => {
    wsWaste.addRow({
      code: cat.category,
      name: cat.label,
      count: cat.count,
      weight: cat.verifiedKg,
      pct: `${cat.percentage}%`,
    });
  });

  // --- Sheet 4: Fleet Performance ---
  const wsFleet = workbook.addWorksheet("Fleet Performance");
  wsFleet.columns = [
    { header: "Vehicle Reg", key: "reg", width: 18 },
    { header: "Type", key: "type", width: 16 },
    { header: "Capacity (kg)", key: "capacity", width: 16 },
    { header: "Assigned Collector", key: "collector", width: 24 },
    { header: "Completed Pickups", key: "completed", width: 18 },
    { header: "Total Waste Collected (kg)", key: "waste", width: 25 },
    { header: "Asset Status", key: "status", width: 14 },
  ];
  styleHeaderRow(wsFleet.getRow(1));

  fleet.fleetRoster.forEach((veh) => {
    wsFleet.addRow({
      reg: veh.registrationNo,
      type: veh.type,
      capacity: veh.capacityKg,
      collector: veh.collectorName,
      completed: veh.completedPickupsCount,
      waste: veh.totalWasteCollectedKg,
      status: veh.isActive ? "Active" : "Inactive",
    });
  });

  // --- Sheet 5: Citizen Activity ---
  const wsCitizens = workbook.addWorksheet("Citizen Activity");
  wsCitizens.columns = [
    { header: "Metric", key: "metric", width: 35 },
    { header: "Count / Rate", key: "val", width: 20 },
  ];
  styleHeaderRow(wsCitizens.getRow(1));

  wsCitizens.addRows([
    { metric: "Total Registered Citizens", val: citizen.totalRegisteredCitizens },
    { metric: "Active Citizens in Window", val: citizen.activeCitizensCount },
    { metric: "Participation Rate", val: `${citizen.citizenParticipationRate}%` },
    { metric: "Green Points Awarded", val: citizen.pointsDistributedInPeriod },
    { metric: "Points Redeemed", val: citizen.totalPointsRedeemed },
    { metric: "Total Redemptions", val: citizen.totalRedemptionsCount },
  ]);

  // --- Sheet 6: Rewards Statistics ---
  const wsRewards = workbook.addWorksheet("Rewards Statistics");
  wsRewards.columns = [
    { header: "Reward Title", key: "name", width: 28 },
    { header: "Points Required", key: "cost", width: 18 },
    { header: "Available Stock", key: "stock", width: 16 },
    { header: "Redemptions Count", key: "redemptions", width: 20 },
  ];
  styleHeaderRow(wsRewards.getRow(1));

  rewards.rewardCatalogue.forEach((rew) => {
    wsRewards.addRow({
      name: rew.name,
      cost: rew.pointsRequired,
      stock: rew.stock,
      redemptions: rew.redemptionsCount,
    });
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  generateCitizenPdf,
  generateAdminPdf,
  generateCitizenCsv,
  generateAdminCsv,
  generateAdminExcel,
};
