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

  if (err.name === "MulterError" || err.message.startsWith("Only image uploads")) {
    return res.status(400).json({ error: err.message });
  }

  const status = err.status || 500;
  if (status === 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.message || "Internal server error" });
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
