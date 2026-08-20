const { REMINDER_THRESHOLD_DAYS } = require("../config/constants");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Computed on-demand (not a scheduled job) since there is no email/SMS/push
// channel in scope to deliver a background notification through — the
// mobile app renders this as a banner on the Home screen.
async function getReminderStatus(tx, userId) {
  const lastCompleted = await tx.pickup.findFirst({
    where: { userId, status: "completed" },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  if (!lastCompleted) {
    return { due: false, daysSinceLastPickup: null, thresholdDays: REMINDER_THRESHOLD_DAYS };
  }

  const daysSince = Math.floor((Date.now() - lastCompleted.updatedAt.getTime()) / MS_PER_DAY);
  return {
    due: daysSince >= REMINDER_THRESHOLD_DAYS,
    daysSinceLastPickup: daysSince,
    thresholdDays: REMINDER_THRESHOLD_DAYS,
  };
}

module.exports = { getReminderStatus };
