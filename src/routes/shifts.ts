import { Router } from "express";
import { z } from "zod";
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

const FixedQuoteRequestSchema = z.object({
  depositCoin: z.string().min(1),
  depositNetwork: z.string().min(1),
  settleCoin: z.string().min(1),
  settleNetwork: z.string().min(1),
  depositAmount: z.string().optional(),
  settleAmount: z.string().optional(),
});

const CreateFixedShiftSchema = z.object({
  quoteId: z.string().min(1),
  settleAddress: z.string().min(1),
  refundAddress: z.string().optional(),
  watchlistId: z.string().optional(),
});

const CreateVariableShiftSchema = z.object({
  depositCoin: z.string().min(1),
  depositNetwork: z.string().min(1),
  settleCoin: z.string().min(1),
  settleNetwork: z.string().min(1),
  settleAddress: z.string().min(1),
  refundAddress: z.string().optional(),
  watchlistId: z.string().optional(),
});

// ============================================
// FIXED QUOTE ENDPOINTS
// ============================================

/**
 * POST /api/shifts/fixed-quote
 * Request a fixed rate quote from SideShift
 */
router.post(
  "/fixed-quote",
  authenticateToken,
  rateLimitConfig.shiftCreation,
  validateTransactionLimits,
  requireKYCForHighValue,
  async (req, res) => {
    try {
      const userId = (req as any).userId;

      // Validate request
      const validationResult = FixedQuoteRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
        return;
      }

      const quoteRequest = validationResult.data;
      const userIp = (req as any).clientIp;

      logger.info(
        {
          userId,
          quoteRequest,
          userIp,
        },
        "Requesting fixed quote"
      );

      // Request quote from SideShift
      const quote = await sideshift.requestFixedQuote(quoteRequest, userIp);

      logger.info(
        {
          userId,
          quoteId: quote.id,
          rate: quote.rate,
          expiresAt: quote.expiresAt,
        },
        "Fixed quote received"
      );

      res.json({
        success: true,
        quote,
      });
    } catch (error: any) {
      logger.error(
        { error, userId: (req as any).userId },
        "Failed to request fixed quote"
      );

      if (error.status && error.status < 500) {
        res.status(error.status).json({
          error: error.message || "Failed to request quote",
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
 * POST /api/shifts/fixed
 * Create a fixed shift from a quote
 */
router.post(
  "/fixed",
  authenticateToken,
  rateLimitConfig.shiftCreation,
  validateTransactionLimits,
  requireKYCForHighValue,
  async (req, res) => {
    try {
      const userId = (req as any).userId;

      // Validate request
      const validationResult = CreateFixedShiftSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
        return;
      }

      const { quoteId, settleAddress, refundAddress, watchlistId } =
        validationResult.data;
      const userIp = (req as any).clientIp;

      logger.info(
        {
          userId,
          quoteId,
          settleAddress,
          watchlistId,
        },
        "Creating fixed shift"
      );

      // If watchlistId provided, verify ownership
      if (watchlistId) {
        const watchlist = store.getWatchlist(watchlistId);
        if (!watchlist) {
          res.status(404).json({ error: "Watchlist not found" });
          return;
        }
        if (watchlist.userId !== userId) {
          res.status(403).json({ error: "Unauthorized" });
          return;
        }
      }

      // Create shift from quote
      const shift = await sideshift.createFixedShift(
        {
          quoteId,
          settleAddress,
          refundAddress,
        },
        userIp
      );

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
        type: "fixed",
        rate: shift.rate,
        depositAmount: shift.depositAmount,
        settleAmount: shift.settleAmount,
        expiresAt: shift.expiresAt,
      });

      logger.info(
        {
          userId,
          shiftId: shift.id,
          shiftJobId: shiftJob.id,
          depositAddress: shift.depositAddress,
        },
        "Fixed shift created successfully"
      );

      res.json({
        success: true,
        shift,
        shiftJob,
      });
    } catch (error: any) {
      logger.error(
        { error, userId: (req as any).userId },
        "Failed to create fixed shift"
      );

      if (error.status && error.status < 500) {
        res.status(error.status).json({
          error: error.message || "Failed to create shift",
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

// ============================================
// VARIABLE SHIFT ENDPOINTS
// ============================================

/**
 * POST /api/shifts/variable
 * Create a variable shift
 */
router.post(
  "/variable",
  authenticateToken,
  rateLimitConfig.shiftCreation,
  validateTransactionLimits,
  requireKYCForHighValue,
  async (req, res) => {
    try {
      const userId = (req as any).userId;

      // Validate request
      const validationResult = CreateVariableShiftSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
        return;
      }

      const {
        depositCoin,
        depositNetwork,
        settleCoin,
        settleNetwork,
        settleAddress,
        refundAddress,
        watchlistId,
      } = validationResult.data;
      const userIp = (req as any).clientIp;

      logger.info(
        {
          userId,
          depositCoin,
          settleCoin,
          watchlistId,
        },
        "Creating variable shift"
      );

      // If watchlistId provided, verify ownership
      if (watchlistId) {
        const watchlist = store.getWatchlist(watchlistId);
        if (!watchlist) {
          res.status(404).json({ error: "Watchlist not found" });
          return;
        }
        if (watchlist.userId !== userId) {
          res.status(403).json({ error: "Unauthorized" });
          return;
        }
      }

      // Create variable shift
      const shift = await sideshift.createVariableShift(
        {
          depositCoin,
          depositNetwork,
          settleCoin,
          settleNetwork,
          settleAddress,
          refundAddress,
        },
        userIp
      );

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
        type: "variable",
        expiresAt: shift.expiresAt,
      });

      logger.info(
        {
          userId,
          shiftId: shift.id,
          shiftJobId: shiftJob.id,
          depositAddress: shift.depositAddress,
        },
        "Variable shift created successfully"
      );

      res.json({
        success: true,
        shift,
        shiftJob,
      });
    } catch (error: any) {
      logger.error(
        { error, userId: (req as any).userId },
        "Failed to create variable shift"
      );

      if (error.status && error.status < 500) {
        res.status(error.status).json({
          error: error.message || "Failed to create shift",
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

// ============================================
// SHIFT STATUS ENDPOINTS
// ============================================

/**
 * GET /api/shifts/:id
 * Get shift status by ID
 */
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const shiftId = req.params.id;

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
      const updatedShiftJob = store.updateShiftJob(shiftJob.id, {
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
        "Shift status updated"
      );

      res.json({
        success: true,
        shift,
        shiftJob: updatedShiftJob,
      });
      return;
    }

    res.json({
      success: true,
      shift,
      shiftJob,
    });
  } catch (error: any) {
    logger.error(
      { error, shiftId: req.params.id },
      "Failed to get shift status"
    );

    if (error.status && error.status < 500) {
      res.status(error.status).json({
        error: error.message || "Failed to get shift status",
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
 * GET /api/shifts
 * Get user's shifts
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const shiftJobs = store.getShiftJobsByUserId(userId);

    res.json({
      success: true,
      shifts: shiftJobs,
    });
  } catch (error: any) {
    logger.error(
      { error, userId: (req as any).userId },
      "Failed to get user shifts"
    );

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;
