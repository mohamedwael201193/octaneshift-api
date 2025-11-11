import * as store from "../store/store";
import { logger } from "../utils/logger";

/**
 * Background Jobs Service
 * Handles periodic maintenance tasks:
 * - Expired shift cleanup (remove old completed shifts)
 * - Stale alert cleanup (remove old alerts)
 *
 * Note: Shift status polling would require implementing getShiftStatus in sideshift.ts
 */

// Job intervals (in milliseconds)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const SHIFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const ALERT_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// Job state
let cleanupInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Clean up expired shifts (older than 30 days)
 */
async function cleanupExpiredShifts(): Promise<void> {
  try {
    const allShifts = store.getAllShiftJobs();
    const cutoffDate = Date.now() - SHIFT_MAX_AGE;
    let removedCount = 0;

    // Note: Store doesn't have deleteShiftJob yet, so we'll just log for now
    const oldShifts = allShifts.filter((shift) => {
      const shiftDate = new Date(shift.createdAt).getTime();
      return (
        shiftDate < cutoffDate &&
        (shift.status === "settled" || shift.status === "refunded")
      );
    });

    removedCount = oldShifts.length;

    logger.info(
      {
        total: allShifts.length,
        removable: removedCount,
        maxAgeDays: 30,
      },
      "Expired shifts cleanup scan completed (deletion not implemented)"
    );
  } catch (error) {
    logger.error({ error }, "Error in shift cleanup job");
  }
}

/**
 * Clean up stale alerts (older than 30 days)
 */
async function cleanupStaleAlerts(): Promise<void> {
  try {
    const allAlerts = store.getAllAlerts();
    const cutoffDate = Date.now() - ALERT_MAX_AGE;
    let removedCount = 0;

    // Just count old alerts - deletion not implemented yet
    const oldAlerts = allAlerts.filter((alert) => {
      const alertDate = new Date(alert.sentAt).getTime();
      return alertDate < cutoffDate;
    });

    removedCount = oldAlerts.length;

    logger.info(
      {
        total: allAlerts.length,
        removable: removedCount,
        maxAgeDays: 30,
      },
      "Stale alerts cleanup scan completed (deletion not implemented)"
    );
  } catch (error) {
    logger.error({ error }, "Error in alert cleanup job");
  }
}

/**
 * Run all cleanup jobs
 */
async function runCleanupJobs(): Promise<void> {
  logger.info("Running scheduled cleanup jobs");
  await Promise.all([cleanupExpiredShifts(), cleanupStaleAlerts()]);
}

/**
 * Start background jobs
 */
export function startBackgroundJobs(): void {
  if (isRunning) {
    logger.warn("Background jobs already running");
    return;
  }

  logger.info("Starting background jobs");

  // Start cleanup jobs (every 24 hours)
  cleanupInterval = setInterval(() => {
    runCleanupJobs().catch((error: any) => {
      logger.error({ error }, "Unhandled error in cleanup jobs");
    });
  }, CLEANUP_INTERVAL);

  // Run initial cleanup after 2 minutes
  setTimeout(() => {
    runCleanupJobs().catch((error: any) => {
      logger.error({ error }, "Error in initial cleanup");
    });
  }, 120000);

  isRunning = true;

  logger.info(
    {
      cleanupIntervalHours: 24,
      shiftMaxAgeDays: 30,
      alertMaxAgeDays: 30,
    },
    "Background jobs started"
  );
}

/**
 * Stop background jobs
 */
export function stopBackgroundJobs(): void {
  if (!isRunning) {
    return;
  }

  logger.info("Stopping background jobs");

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  isRunning = false;
  logger.info("Background jobs stopped");
}

/**
 * Get background jobs status
 */
export function getJobsStatus(): {
  running: boolean;
  intervals: {
    cleanupHours: number;
  };
  maxAge: {
    shiftDays: number;
    alertDays: number;
  };
} {
  return {
    running: isRunning,
    intervals: {
      cleanupHours: CLEANUP_INTERVAL / 3600000,
    },
    maxAge: {
      shiftDays: SHIFT_MAX_AGE / 86400000,
      alertDays: ALERT_MAX_AGE / 86400000,
    },
  };
}

/**
 * Manually trigger cleanup jobs
 */
export async function triggerCleanup(): Promise<void> {
  logger.info("Manual cleanup triggered");
  await runCleanupJobs();
}
