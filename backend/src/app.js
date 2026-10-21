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

const http = require("http");
const path = require("path");
const { initSocketServer } = require("./socket");
const trackingRoutes = require("./routes/trackingRoutes");
const driverRoutes = require("./routes/driverRoutes");

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
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  },
  express.static(path.join(__dirname, "../uploads"), {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/pickups", trackingRoutes);
app.use("/api/pickups", pickupRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/badges", badgeRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/uploads", uploadRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

// Global unhandled promise rejection and exception loggers to prevent silent server death
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fatal] Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught Exception:", err);
  process.exit(1);
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
initSocketServer(server);

server.listen(PORT, "0.0.0.0", () => console.log(`WasteWise API & Socket.IO listening on port ${PORT}`));

app.server = server;
module.exports = app;
