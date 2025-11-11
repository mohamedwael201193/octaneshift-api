import { Router } from "express";
import { z } from "zod";
import * as chains from "../lib/chains";
import sideshift from "../lib/sideshift";
import { authenticateToken } from "../middleware/auth";
import {
  requireKYCForHighValue,
  validateTransactionLimits,
} from "../middleware/compliance";
import { rateLimitConfig } from "../middleware/rateLimit";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

// ============================================
// SCHEMAS FOR REQUEST VALIDATION
// ============================================

const InitiateTopupSchema = z.object({
  watchlistId: z.string().min(1),
  shiftType: z.enum(["fixed", "variable"]),
  depositAmount: z.string().optional(), // For fixed quotes
  depositCoin: z.string().min(1),
  depositNetwork: z.string().min(1),
  refundAddress: z.string().optional(),
});

// ============================================
// TOP-UP FLOW ENDPOINTS
// ============================================

/**
 * POST /api/topup/initiate
 * Initiate a top-up for a watchlist
 */
router.post(
  "/initiate",
  authenticateToken,
  rateLimitConfig.topupCreation,
  validateTransactionLimits,
  requireKYCForHighValue,
  async (req, res) => {
    try {
      const userId = (req as any).userId;

      // Validate request
      const validationResult = InitiateTopupSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
        return;
      }

      const {
        watchlistId,
        shiftType,
        depositAmount,
        depositCoin,
        depositNetwork,
        refundAddress,
      } = validationResult.data;

      // Get watchlist
      const watchlist = store.getWatchlist(watchlistId);
      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      // Verify ownership
      if (watchlist.userId !== userId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      const userIp = (req as any).clientIp;

      // Get chain configuration for settlement
      const chainConfig = chains.getChainConfig(watchlist.chain as any);
      const settleCoin = chainConfig.nativeCurrency.symbol.toLowerCase();
      const settleNetwork = watchlist.chain;

      logger.info(
        {
          userId,
          watchlistId,
          shiftType,
          depositCoin,
          settleCoin,
        },
        "Initiating top-up"
      );

      let shift;
      let quote;

      if (shiftType === "fixed") {
        // For fixed shifts, we need to request a quote first
        if (!depositAmount) {
          res.status(400).json({
            error: "depositAmount is required for fixed shifts",
          });
          return;
        }

        // Request fixed quote
        quote = await sideshift.requestFixedQuote(
          {
            depositCoin,
            depositNetwork,
            settleCoin,
            settleNetwork,
            depositAmount,
          },
          userIp
        );

        // Create fixed shift from quote
        shift = await sideshift.createFixedShift(
          {
            quoteId: quote.id,
            settleAddress: watchlist.address,
            refundAddress,
          },
          userIp
        );
      } else {
        // Create variable shift
        shift = await sideshift.createVariableShift(
          {
            depositCoin,
            depositNetwork,
            settleCoin,
            settleNetwork,
            settleAddress: watchlist.address,
            refundAddress,
          },
          userIp
        );
      }

      // Create shift job in store
      const shiftJob = store.createShiftJob({
        userId,
        shiftId: shift.id,
        watchlistId,
        depositCoin: shift.depositCoin,
        depositNetwork: shift.depositNetwork,
        settleCoin: shift.settleCoin,
        settleNetwork: shift.settleNetwork,
        depositAddress: shift.depositAddress,
        settleAddress: shift.settleAddress,
        status: shift.status,
        type: shiftType,
        rate: shift.rate,
        depositAmount: shift.depositAmount,
        settleAmount: shift.settleAmount,
        expiresAt: shift.expiresAt,
      });

      logger.info(
        {
          userId,
          watchlistId,
          shiftId: shift.id,
          depositAddress: shift.depositAddress,
          type: shiftType,
        },
        "Top-up initiated successfully"
      );

      res.json({
        success: true,
        shift,
        shiftJob,
        ...(quote && { quote }),
        instructions: {
          step: 1,
          action: "deposit",
          message: `Send ${
            depositAmount || "crypto"
          } ${depositCoin.toUpperCase()} to the deposit address`,
          depositAddress: shift.depositAddress,
          expiresAt: shift.expiresAt,
        },
      });
    } catch (error: any) {
      logger.error(
        { error, userId: (req as any).userId },
        "Failed to initiate top-up"
      );

      if (error.status && error.status < 500) {
        res.status(error.status).json({
          error: error.message || "Failed to initiate top-up",
          code: error.code,
        });
      } else {
        res.status(500).json({
          error: "Internal server error",
        });
      }
    }
  }
);

/**
 * GET /api/topup/:shiftId/status
 * Check the status of a top-up shift
 */
router.get("/:shiftId/status", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const shiftId = req.params.shiftId;

    // Get shift job from store
    const shiftJob = store.getShiftJobByShiftId(shiftId);
    if (!shiftJob) {
      res.status(404).json({ error: "Shift not found" });
      return;
    }

    // Verify ownership
    if (shiftJob.userId !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    const userIp = (req as any).clientIp;

    // Get fresh status from SideShift
    const shift = await sideshift.getShift(shiftId, userIp);

    // Update shift job status if changed
    if (shift.status !== shiftJob.status) {
      store.updateShiftJob(shiftJob.id, {
        status: shift.status,
        depositAmount: shift.depositAmount,
        settleAmount: shift.settleAmount,
      });

      logger.info(
        {
          userId,
          shiftId,
          oldStatus: shiftJob.status,
          newStatus: shift.status,
        },
        "Top-up status updated"
      );
    }

    // Get watchlist if linked
    let watchlist;
    if (shiftJob.watchlistId) {
      watchlist = store.getWatchlist(shiftJob.watchlistId);
    }

    // Determine the next step based on status
    let instructions;
    switch (shift.status) {
      case "waiting":
        instructions = {
          step: 1,
          action: "deposit",
          message: "Waiting for deposit",
          depositAddress: shift.depositAddress,
        };
        break;
      case "pending":
      case "processing":
        instructions = {
          step: 2,
          action: "processing",
          message: "Processing your transaction",
        };
        break;
      case "settled":
        instructions = {
          step: 3,
          action: "completed",
          message: "Top-up completed successfully!",
          settleAmount: shift.settleAmount,
        };
        break;
      case "refunding":
      case "refunded":
        instructions = {
          step: 3,
          action: "refunded",
          message: "Transaction refunded",
        };
        break;
    }

    res.json({
      success: true,
      shift,
      shiftJob,
      ...(watchlist && { watchlist }),
      instructions,
    });
  } catch (error: any) {
    logger.error(
      { error, shiftId: req.params.shiftId },
      "Failed to get top-up status"
    );

    if (error.status && error.status < 500) {
      res.status(error.status).json({
        error: error.message || "Failed to get top-up status",
        code: error.code,
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
});

/**
 * POST /api/topup/:shiftId/confirm
 * Mark that user has made the deposit (for UX tracking, optional)
 */
router.post("/:shiftId/confirm", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const shiftId = req.params.shiftId;

    // Get shift job from store
    const shiftJob = store.getShiftJobByShiftId(shiftId);
    if (!shiftJob) {
      res.status(404).json({ error: "Shift not found" });
      return;
    }

    // Verify ownership
    if (shiftJob.userId !== userId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    // Get latest status from SideShift
    const userIp = (req as any).clientIp;
    const shift = await sideshift.getShift(shiftId, userIp);

    // Update job with latest status
    const updatedJob = store.updateShiftJob(shiftJob.id, {
      status: shift.status,
      depositAmount: shift.depositAmount,
      settleAmount: shift.settleAmount,
    });

    logger.info(
      {
        userId,
        shiftId,
        status: shift.status,
      },
      "Top-up confirmed by user"
    );

    res.json({
      success: true,
      message: "Deposit confirmed. Tracking status.",
      shift,
      shiftJob: updatedJob,
    });
  } catch (error: any) {
    logger.error(
      { error, shiftId: req.params.shiftId },
      "Failed to confirm top-up"
    );

    if (error.status && error.status < 500) {
      res.status(error.status).json({
        error: error.message || "Failed to confirm top-up",
        code: error.code,
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
});

/**
 * GET /api/topup/watchlist/:watchlistId/history
 * Get top-up history for a watchlist
 */
router.get(
  "/watchlist/:watchlistId/history",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = (req as any).userId;
      const watchlistId = req.params.watchlistId;

      // Get watchlist
      const watchlist = store.getWatchlist(watchlistId);
      if (!watchlist) {
        res.status(404).json({ error: "Watchlist not found" });
        return;
      }

      // Verify ownership
      if (watchlist.userId !== userId) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

      // Get all shifts for this watchlist
      const shiftJobs = store.getShiftJobsByWatchlistId(watchlistId);

      // Sort by creation date (most recent first)
      shiftJobs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json({
        success: true,
        watchlist,
        history: shiftJobs,
        count: shiftJobs.length,
      });
    } catch (error: any) {
      logger.error(
        { error, watchlistId: req.params.watchlistId },
        "Failed to get watchlist top-up history"
      );

      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

export default router;
