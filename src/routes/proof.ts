import { Router } from "express";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/proof/shift/:id
 * Get proof of payment for a single shift
 * Returns comprehensive shift details including timeline
 */
router.get("/shift/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const shiftJob = store.getShiftJobByShiftId(id);

    if (!shiftJob) {
      return res.status(404).json({
        success: false,
        error: "Shift not found",
      });
    }

    // Build timeline from status changes
    const timeline = [
      {
        status: "created",
        timestamp: shiftJob.createdAt,
        label: "Shift Created",
      },
    ];

    if (shiftJob.updatedAt && shiftJob.status !== "waiting") {
      timeline.push({
        status: shiftJob.status,
        timestamp: shiftJob.updatedAt,
        label: getStatusLabel(shiftJob.status),
      });
    }

    return res.json({
      success: true,
      data: {
        shiftId: shiftJob.shiftId,
        status: shiftJob.status,
        type: shiftJob.type || "variable",
        depositCoin: shiftJob.depositCoin,
        depositNetwork: shiftJob.depositNetwork,
        depositAddress: shiftJob.depositAddress,
        depositAmount: shiftJob.depositAmount,
        settleCoin: shiftJob.settleCoin,
        settleNetwork: shiftJob.settleNetwork,
        settleAddress: shiftJob.settleAddress,
        settleMemo: shiftJob.settleMemo,
        settleAmount: shiftJob.settleAmount,
        refundAddress: shiftJob.refundAddress,
        refundMemo: shiftJob.refundMemo,
        rate: shiftJob.rate,
        expiresAt: shiftJob.expiresAt,
        txHash: shiftJob.txHash,
        timeline,
        createdAt: shiftJob.createdAt,
        updatedAt: shiftJob.updatedAt,
      },
    });
  } catch (error) {
    logger.error(
      { error, shiftId: req.params.id },
      "Failed to get shift proof"
    );
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve proof",
    });
  }
});

/**
 * GET /api/proof/batch/:payoutId
 * Get proof of payment for a batch payout
 * Returns all shifts in the batch with aggregated statistics
 */
router.get("/batch/:payoutId", async (req, res) => {
  try {
    const { payoutId } = req.params;

    const jobs = store.getShiftJobsByPayoutId(payoutId);

    if (jobs.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Batch not found",
      });
    }

    // Build proof data for each shift
    const shifts = jobs.map((job) => {
      const timeline = [
        {
          status: "created",
          timestamp: job.createdAt,
          label: "Shift Created",
        },
      ];

      if (job.updatedAt && job.status !== "waiting") {
        timeline.push({
          status: job.status,
          timestamp: job.updatedAt,
          label: getStatusLabel(job.status),
        });
      }

      return {
        shiftId: job.shiftId,
        status: job.status,
        type: job.type || "variable",
        depositCoin: job.depositCoin,
        depositNetwork: job.depositNetwork,
        depositAddress: job.depositAddress,
        depositAmount: job.depositAmount,
        settleCoin: job.settleCoin,
        settleNetwork: job.settleNetwork,
        settleAddress: job.settleAddress,
        settleMemo: job.settleMemo,
        settleAmount: job.settleAmount,
        refundAddress: job.refundAddress,
        rate: job.rate,
        expiresAt: job.expiresAt,
        txHash: job.txHash,
        timeline,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    });

    // Calculate summary statistics
    const summary = {
      total: jobs.length,
      completed: jobs.filter((j) => j.status === "settled").length,
      pending: jobs.filter((j) =>
        ["waiting", "pending", "processing"].includes(j.status)
      ).length,
      failed: jobs.filter((j) => ["refunded", "refunding"].includes(j.status))
        .length,
      totalDepositAmount: jobs
        .filter((j) => j.depositAmount)
        .reduce((sum, j) => sum + parseFloat(j.depositAmount || "0"), 0)
        .toFixed(8),
      totalSettleAmount: jobs
        .filter((j) => j.settleAmount)
        .reduce((sum, j) => sum + parseFloat(j.settleAmount || "0"), 0)
        .toFixed(8),
    };

    return res.json({
      success: true,
      data: {
        payoutId,
        shifts,
        summary,
        createdAt: jobs[0]?.createdAt,
      },
    });
  } catch (error) {
    logger.error(
      { error, payoutId: req.params.payoutId },
      "Failed to get batch proof"
    );
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve batch proof",
    });
  }
});

/**
 * Helper function to get human-readable status label
 */
function getStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    waiting: "Waiting for Deposit",
    pending: "Deposit Received",
    processing: "Processing",
    settled: "Completed",
    refunding: "Refunding",
    refunded: "Refunded",
  };

  return labels[status] || status;
}

export default router;
