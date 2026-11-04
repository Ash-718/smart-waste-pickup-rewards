const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const {
  startSimulation,
  stopSimulation,
  isSimulationActive,
} = require("../services/simulationService");

const router = express.Router();

/**
 * POST /api/simulation/:pickupId/start
 * Starts virtual driver movement simulation for a pickup.
 */
router.post(
  "/:pickupId/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { pickupId } = req.params;
    const { speedKmh } = req.body || {};
    const result = await startSimulation(pickupId, { speedKmh });
    res.json(result);
  })
);

/**
 * POST /api/simulation/:pickupId/stop
 * Stops virtual driver movement simulation for a pickup.
 */
router.post(
  "/:pickupId/stop",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { pickupId } = req.params;
    const result = stopSimulation(pickupId);
    res.json(result);
  })
);

/**
 * GET /api/simulation/:pickupId/status
 * Returns whether virtual driver simulation is active for a pickup.
 */
router.get(
  "/:pickupId/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { pickupId } = req.params;
    res.json({
      pickupId,
      active: isSimulationActive(pickupId),
    });
  })
);

module.exports = router;
