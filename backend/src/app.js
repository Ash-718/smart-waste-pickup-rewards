require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { errorHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/authRoutes");
const pickupRoutes = require("./routes/pickupRoutes");
const pointsRoutes = require("./routes/pointsRoutes");
const badgeRoutes = require("./routes/badgeRoutes");
const rewardRoutes = require("./routes/rewardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const metaRoutes = require("./routes/metaRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

const app = express();
app.disable("x-powered-by");

// Comma-separated allowlist of client origins (mobile app dev server, admin
// dashboard). Falls back to allowing any origin only when unset, so local
// development isn't blocked before CORS_ORIGIN is configured.
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/pickups", pickupRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/badges", badgeRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/uploads", uploadRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`WasteWise API listening on port ${PORT}`));

module.exports = app;
