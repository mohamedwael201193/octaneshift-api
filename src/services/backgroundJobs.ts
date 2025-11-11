import sideshift from "../lib/sideshift";
import * as store from "../store/store";
import { logger } from "../utils/logger";
import * as notificationService from "./notifications";

/**
 * Background Jobs Service
 * Handles periodic maintenance tasks:
 * - Expired shift cleanup (remove old completed shifts)
 * - Stale alert cleanup (remove old alerts)
 * - Shift status polling (check for refunded/expired shifts)
 */

// Job intervals (in milliseconds)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const SHIFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const ALERT_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const STATUS_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Job state
let cleanupInterval: NodeJS.Timeout | null = null;
let statusPollInterval: NodeJS.Timeout | null = null;
let isRunning = false;

// Track which shifts have already been notified to avoid duplicates
const notifiedShifts = new Set<string>();

/**
 * Poll shift statuses for refunded/expired shifts
 */
async function pollShiftStatuses(): Promise<void> {
  try {
    const allShifts = store.getAllShiftJobs();

    // Only check shifts that are in pending/waiting status
    const activeShifts = allShifts.filter(
      (shift) =>
        shift.status === "pending" ||
        shift.status === "waiting" ||
        !notifiedShifts.has(shift.id)
    );

    logger.debug({ count: activeShifts.length }, "Polling shift statuses");

    for (const shift of activeShifts) {
      try {
        // Get current status from SideShift
        const sideshiftStatus = await sideshift.getShift(shift.id);

        // Check if status changed to refunded or expired
        if (
          sideshiftStatus.status === "refunded" &&
          !notifiedShifts.has(shift.id)
        ) {
          // Send refund notification
          notificationService.notifyShiftRefunded(
            shift.userId,
            shift.id,
            shift.refundAddress || "N/A",
            shift.refundMemo,
            sideshiftStatus.depositAmount || "unknown",
            shift.depositCoin
          );

          // Update shift status in store
          store.updateShiftJob(shift.id, { status: "refunded" });

          notifiedShifts.add(shift.id);

          logger.info(
            {
              shiftId: shift.id,
              userId: shift.userId,
            },
            "Shift refunded - notification sent"
          );
        } else if (
          sideshiftStatus.expiresAt &&
          new Date(sideshiftStatus.expiresAt) < new Date() &&
          sideshiftStatus.status === "waiting" &&
          !notifiedShifts.has(shift.id)
        ) {
          // Send expired notification (shift expired without deposit)
          notificationService.notifyShiftExpired(
            shift.userId,
            shift.id,
            shift.settleAddress,
            shift.settleCoin
          );

          notifiedShifts.add(shift.id);

          logger.info(
            {
              shiftId: shift.id,
              userId: shift.userId,
            },
            "Shift expired - notification sent"
          );
        } else if (sideshiftStatus.status !== shift.status) {
          // Update status if changed
          store.updateShiftJob(shift.id, { status: sideshiftStatus.status });

          logger.debug(
            {
              shiftId: shift.id,
              oldStatus: shift.status,
              newStatus: sideshiftStatus.status,
            },
            "Shift status updated"
          );
        }
      } catch (error: any) {
        // Skip individual shift errors (might be 404 for old shifts)
        logger.debug(
          {
            shiftId: shift.id,
            error: error.message,
          },
          "Error checking shift status"
        );
      }
    }
  } catch (error) {
    logger.error({ error }, "Error in shift status polling job");
  }
}

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

  // Start shift status polling (every 5 minutes)
  statusPollInterval = setInterval(() => {
    pollShiftStatuses().catch((error: any) => {
      logger.error({ error }, "Unhandled error in shift status polling");
    });
  }, STATUS_POLL_INTERVAL);

  // Run initial cleanup after 2 minutes
  setTimeout(() => {
    runCleanupJobs().catch((error: any) => {
      logger.error({ error }, "Error in initial cleanup");
    });
  }, 120000);

  // Run initial status poll after 30 seconds
  setTimeout(() => {
    pollShiftStatuses().catch((error: any) => {
      logger.error({ error }, "Error in initial status poll");
    });
  }, 30000);

  isRunning = true;

  logger.info(
    {
      cleanupIntervalHours: 24,
      statusPollIntervalMinutes: 5,
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

  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
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
