const { ZodError } = require("zod");

// Centralized error handler. Route handlers call next(err) or throw inside
// asyncHandler-wrapped functions; this is the only place that shapes the
// error response so clients get a consistent JSON error format.
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }

  if (err.code === "P2002") {
    return res.status(409).json({ error: "A record with this value already exists" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }

  if (err.code === "P2003") {
    return res.status(400).json({ error: "Referenced record does not exist" });
  }

  if (err.code === "P2034") {
    return res.status(409).json({ error: "That conflicted with another update — please try again" });
  }

  if (err.name === "MulterError" || (err.message && err.message.startsWith("Only image uploads"))) {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  // Handle database connection / initialization errors cleanly
  if (
    err.code === "P1000" ||
    err.code === "P1001" ||
    err.code === "P1002" ||
    err.code === "P1003" ||
    err.name === "PrismaClientInitializationError"
  ) {
    console.error("[Database Connection Error]", err);
    return res.status(503).json({ error: "Unable to connect to the server. Please try again." });
  }

  // Any other unexpected server or database errors
  console.error("[Unhandled Server Error]", err);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { errorHandler, asyncHandler, HttpError };
