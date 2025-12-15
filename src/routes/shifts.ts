import { Router } from "express";
import { z } from "zod";
import * as idempotency from "../lib/idempotency";
import sideshift from "../lib/sideshift";
import * as simulator from "../lib/simulator";
import { authenticateToken } from "../middleware/auth";
import {
  requireKYCForHighValue,
  validateTransactionLimits,
} from "../middleware/compliance";
import { rateLimitConfig } from "../middleware/rateLimit";
import loyalty from "../services/loyalty";
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
  settleMemo: z.string().optional(),
  refundAddress: z.string().optional(),
  refundMemo: z.string().optional(),
  watchlistId: z.string().optional(),
});

const CreateVariableShiftSchema = z.object({
  depositCoin: z.string().min(1),
  depositNetwork: z.string().min(1),
  settleCoin: z.string().min(1),
  settleNetwork: z.string().min(1),
  settleAddress: z.string().min(1),
  settleMemo: z.string().optional(),
  refundAddress: z.string().optional(),
  refundMemo: z.string().optional(),
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

      // Check quote rate limit (20/min)
      const quoteRateLimit = idempotency.checkQuoteRateLimit(userId);
      if (!quoteRateLimit.allowed) {
        const resetIn = Math.ceil(
          (quoteRateLimit.resetTime - Date.now()) / 1000
        );
        return res.status(429).json({
          error: "Quote rate limit exceeded. Maximum 20 quotes per minute.",
          retryAfter: resetIn,
          resetTime: new Date(quoteRateLimit.resetTime).toISOString(),
        });
      }

      // Validate request
      const validationResult = FixedQuoteRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
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

      // Check regional restrictions
      const regionalCheck = await simulator.checkRegionalRestrictions(
        sideshift,
        userIp
      );

      if (regionalCheck.simulatorMode) {
        // Return simulated quote with 451 status
        const simulatedQuote = simulator.createSimulatedFixedQuote({
          userId,
          depositCoin: quoteRequest.depositCoin,
          depositNetwork: quoteRequest.depositNetwork,
          settleCoin: quoteRequest.settleCoin,
          settleNetwork: quoteRequest.settleNetwork,
          settleAmount: quoteRequest.settleAmount || "0.01",
        });

        logger.info(
          {
            userId,
            quoteId: simulatedQuote.id,
            simulated: true,
          },
          "Returning simulated quote due to regional restrictions"
        );

        return res.status(451).json({
          success: true,
          quote: simulatedQuote,
          simulator: true,
          permissions: regionalCheck.permissions,
        });
      }

      // Request quote from SideShift with retry logic
      const quote = await idempotency.withRetry(
        () => sideshift.requestFixedQuote(quoteRequest, userIp),
        {},
        "fixed-quote-request"
      );

      logger.info(
        {
          userId,
          quoteId: quote.id,
          rate: quote.rate,
          expiresAt: quote.expiresAt,
        },
        "Fixed quote received"
      );

      return res.json({
        success: true,
        quote,
      });
    } catch (error: any) {
      logger.error(
        { error, userId: (req as any).userId },
        "Failed to request fixed quote"
      );

      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          error: error.message || "Failed to request quote",
          code: error.code,
        });
      } else {
        return res.status(500).json({
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

      // Check shift rate limit (5/min)
      const shiftRateLimit = idempotency.checkShiftRateLimit(userId);
      if (!shiftRateLimit.allowed) {
        const resetIn = Math.ceil(
          (shiftRateLimit.resetTime - Date.now()) / 1000
        );
        return res.status(429).json({
          error:
            "Shift creation rate limit exceeded. Maximum 5 shifts per minute.",
          retryAfter: resetIn,
          resetTime: new Date(shiftRateLimit.resetTime).toISOString(),
        });
      }

      // Enforce sequential delay between shift creations
      await idempotency.enforceSequentialDelay();

      // Validate request
      const validationResult = CreateFixedShiftSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
      }

      const {
        quoteId,
        settleAddress,
        settleMemo,
        refundAddress,
        refundMemo,
        watchlistId,
      } = validationResult.data;
      const userIp = (req as any).clientIp;

      // Generate external ID for idempotency
      const externalId = idempotency.generateExternalId(userId, settleAddress);

      logger.info(
        {
          userId,
          quoteId,
          settleAddress,
          watchlistId,
          externalId,
        },
        "Creating fixed shift"
      );

      // If watchlistId provided, verify ownership
      if (watchlistId) {
        const watchlist = store.getWatchlist(watchlistId);
        if (!watchlist) {
          return res.status(404).json({ error: "Watchlist not found" });
        }
        if (watchlist.userId !== userId) {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      // Check regional restrictions before creating shift
      const regionalCheck = await simulator.checkRegionalRestrictions(
        sideshift,
        userIp
      );

      if (regionalCheck.simulatorMode) {
        // In simulator mode, use reasonable defaults
        // (We don't have access to the original quote details)
        const simulatedShift = simulator.createSimulatedFixedShift({
          userId,
          depositCoin: "btc",
          depositNetwork: "bitcoin",
          settleCoin: "eth",
          settleNetwork: "ethereum",
          settleAmount: "0.01",
          settleAddress,
          settleMemo,
          refundAddress,
          refundMemo,
        });

        // Store simulated shift job for UI consistency
        const simulatedJob = store.createShiftJob({
          userId,
          shiftId: simulatedShift.id,
          watchlistId,
          depositCoin: simulatedShift.depositCoin,
          depositNetwork: simulatedShift.depositNetwork,
          settleCoin: simulatedShift.settleCoin,
          settleNetwork: simulatedShift.settleNetwork,
          depositAddress: simulatedShift.depositAddress,
          settleAddress: simulatedShift.settleAddress,
          settleMemo,
          refundAddress,
          refundMemo,
          status: simulatedShift.status,
          type: "fixed",
          rate: simulatedShift.rate,
          depositAmount: simulatedShift.depositAmount,
          settleAmount: simulatedShift.settleAmount,
          expiresAt: simulatedShift.expiresAt,
        });

        logger.info(
          {
            userId,
            shiftId: simulatedShift.id,
            simulated: true,
          },
          "Returning simulated fixed shift due to regional restrictions"
        );

        return res.status(451).json({
          success: true,
          shift: simulatedShift,
          shiftJob: simulatedJob,
          simulator: true,
          permissions: regionalCheck.permissions,
        });
      }

      // Create shift from quote with retry logic
      const shift = await idempotency.withRetry(
        () =>
          sideshift.createFixedShift(
            {
              quoteId,
              settleAddress,
              settleMemo,
              refundAddress,
              refundMemo,
              externalId,
            },
            userIp
          ),
        {},
        "create-fixed-shift"
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
        settleMemo,
        refundAddress,
        refundMemo,
        status: shift.status,
        type: "fixed",
        rate: shift.rate,
        depositAmount: shift.depositAmount,
        settleAmount: shift.settleAmount,
        expiresAt: shift.expiresAt,
      });

      // Persist to disk
      await store.save();

      // Record to loyalty system
      const volumeUsd = parseFloat(shift.settleAmount || "0") * 2500; // Estimate USD value
      loyalty.recordShift(userId, shift.settleNetwork, volumeUsd, false, false);

      logger.info(
        {
          userId,
          shiftId: shift.id,
          shiftJobId: shiftJob.id,
          depositAddress: shift.depositAddress,
          externalId,
        },
        "Fixed shift created successfully"
      );

      return res.json({
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
        return res.status(error.status).json({
          error: error.message || "Failed to create shift",
          code: error.code,
        });
      } else {
        return res.status(500).json({
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

      // Check shift rate limit (5 shifts per minute)
      const rateLimitCheck = idempotency.checkShiftRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((rateLimitCheck.resetTime - Date.now()) / 1000),
          resetTime: new Date(rateLimitCheck.resetTime).toISOString(),
          limit: "5 shifts per minute",
        });
      }

      // Enforce sequential delay (800ms between operations)
      await idempotency.enforceSequentialDelay();

      // Validate request
      const validationResult = CreateVariableShiftSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
      }

      const {
        depositCoin,
        depositNetwork,
        settleCoin,
        settleNetwork,
        settleAddress,
        settleMemo,
        refundAddress,
        refundMemo,
        watchlistId,
      } = validationResult.data;
      const userIp = (req as any).clientIp;

      // Generate external ID for idempotency
      const externalId = idempotency.generateExternalId(
        userId,
        settleAddress,
        Date.now()
      );

      logger.info(
        {
          userId,
          depositCoin,
          settleCoin,
          watchlistId,
          externalId,
        },
        "Creating variable shift"
      );

      // If watchlistId provided, verify ownership
      if (watchlistId) {
        const watchlist = store.getWatchlist(watchlistId);
        if (!watchlist) {
          return res.status(404).json({ error: "Watchlist not found" });
        }
        if (watchlist.userId !== userId) {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      // Check regional restrictions before creating shift
      const regionalCheck = await simulator.checkRegionalRestrictions(
        sideshift,
        userIp
      );

      if (regionalCheck.simulatorMode) {
        // Return simulated variable shift with 451 status
        const simulatedShift = simulator.createSimulatedVariableShift({
          userId,
          depositCoin,
          depositNetwork,
          settleCoin,
          settleNetwork,
          settleAddress,
          settleMemo,
          refundAddress,
          refundMemo,
        });

        // Store simulated shift job for UI consistency
        const simulatedJob = store.createShiftJob({
          userId,
          shiftId: simulatedShift.id,
          watchlistId,
          depositCoin: simulatedShift.depositCoin,
          depositNetwork: simulatedShift.depositNetwork,
          settleCoin: simulatedShift.settleCoin,
          settleNetwork: simulatedShift.settleNetwork,
          depositAddress: simulatedShift.depositAddress,
          settleAddress: simulatedShift.settleAddress,
          settleMemo,
          refundAddress,
          refundMemo,
          status: simulatedShift.status,
          type: "variable",
          expiresAt: simulatedShift.expiresAt,
        });

        logger.info(
          {
            userId,
            shiftId: simulatedShift.id,
            simulated: true,
          },
          "Returning simulated variable shift due to regional restrictions"
        );

        return res.status(451).json({
          success: true,
          shift: simulatedShift,
          shiftJob: simulatedJob,
          simulator: true,
          permissions: regionalCheck.permissions,
        });
      }

      // Create variable shift with retry logic
      const shift = await idempotency.withRetry(
        () =>
          sideshift.createVariableShift(
            {
              depositCoin,
              depositNetwork,
              settleCoin,
              settleNetwork,
              settleAddress,
              settleMemo,
              refundAddress,
              refundMemo,
              externalId,
            },
            userIp
          ),
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: 2,
        },
        "createVariableShift"
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
        settleMemo,
        refundAddress,
        refundMemo,
        status: shift.status,
        type: "variable",
        expiresAt: shift.expiresAt,
      });

      // Persist to disk
      await store.save();

      // Record to loyalty system
      const depositMin = parseFloat(shift.depositMin || "0");
      const volumeUsd =
        depositMin *
        (shift.depositCoin === "usdc" || shift.depositCoin === "usdt"
          ? 1
          : 2500);
      loyalty.recordShift(userId, shift.settleNetwork, volumeUsd, false, false);

      logger.info(
        {
          userId,
          shiftId: shift.id,
          shiftJobId: shiftJob.id,
          depositAddress: shift.depositAddress,
        },
        "Variable shift created successfully"
      );

      return res.json({
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
        return res.status(error.status).json({
          error: error.message || "Failed to create shift",
          code: error.code,
        });
      } else {
        return res.status(500).json({
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
 * GET /api/shifts/recent
 * Get recent shifts (all users, for status dashboard)
 */
router.get("/recent", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    // Get all shift jobs and sort by creation time
    const allShifts = store.getAllShiftJobs();
    const recentShifts = allShifts
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit)
      .map((shift) => ({
        id: shift.shiftId,
        status: shift.status,
        depositCoin: shift.depositCoin,
        depositNetwork: shift.depositNetwork,
        settleCoin: shift.settleCoin,
        settleNetwork: shift.settleNetwork,
        createdAt: shift.createdAt,
        depositAmount: shift.depositAmount,
        settleAmount: shift.settleAmount,
      }));

    res.json({
      success: true,
      data: recentShifts,
    });
  } catch (error: any) {
    logger.error({ error }, "Failed to get recent shifts");
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/shifts/public/:id
 * Public endpoint to get shift status by ID (for Proof page)
 * No authentication required - anyone with shift ID can view
 */
router.get("/public/:id", async (req, res) => {
  try {
    const shiftId = req.params.id;
    const userIp = (req as any).clientIp;

    logger.info({ shiftId }, "Public shift lookup");

    // Get fresh status from SideShift
    const shift = await sideshift.getShift(shiftId, userIp);

    res.json({
      success: true,
      data: shift,
    });
  } catch (error: any) {
    logger.error(
      { error, shiftId: req.params.id },
      "Failed to get public shift status"
    );

    if (error.status === 404) {
      res.status(404).json({
        error: "Shift not found",
      });
    } else if (error.status && error.status < 500) {
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
 * GET /api/shifts/:id
 * Get shift status by ID (authenticated - for user's own shifts)
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

/**
 * GET /api/shifts/rate-limit-stats
 * Get user's current rate limit status
 */
router.get("/rate-limit-stats", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const stats = idempotency.getUserRateLimitStats(userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error(
      { error, userId: (req as any).userId },
      "Failed to get rate limit stats"
    );

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/shifts/cancel
 * Cancel an order (must be after 5 minutes)
 */
router.post(
  "/cancel",
  authenticateToken,
  rateLimitConfig.strict,
  async (req, res) => {
    try {
      const { shiftId } = req.body;
      const userId = (req as any).userId;
      const clientIp = (req as any).clientIp;

      if (!shiftId) {
        return res.status(400).json({ error: "shiftId is required" });
      }

      // Verify the shift belongs to the user
      const shiftJob = store.getShiftJob(shiftId);
      if (!shiftJob) {
        return res.status(404).json({ error: "Shift not found" });
      }

      if (shiftJob.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to cancel this shift" });
      }

      // Call SideShift cancel API
      const result = await sideshift.cancelOrder(shiftId, clientIp);

      // Update shift status in our records
      shiftJob.status = "refunding";
      shiftJob.updatedAt = new Date().toISOString();

      logger.info({ shiftId, userId }, "Order cancelled successfully");

      return res.json({
        success: true,
        message: result.message,
        shiftId,
      });
    } catch (error: any) {
      logger.error(
        { error, shiftId: req.body.shiftId },
        "Failed to cancel order"
      );

      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          error: error.message || "Failed to cancel order",
          code: error.code,
        });
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * POST /api/shifts/:id/refund-address
 * Set or update refund address for a shift
 */
router.post(
  "/:id/refund-address",
  authenticateToken,
  rateLimitConfig.strict,
  async (req, res) => {
    try {
      const { id: shiftId } = req.params;
      const { address, memo } = req.body;
      const userId = (req as any).userId;
      const clientIp = (req as any).clientIp;

      if (!address) {
        return res.status(400).json({ error: "address is required" });
      }

      // Verify the shift belongs to the user
      const shiftJob = store.getShiftJob(shiftId);
      if (!shiftJob) {
        return res.status(404).json({ error: "Shift not found" });
      }

      if (shiftJob.userId !== userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to update this shift" });
      }

      // Call SideShift API to set refund address
      const updatedShift = await sideshift.setRefundAddress(
        shiftId,
        address,
        memo,
        clientIp
      );

      // Update our records
      shiftJob.refundAddress = address;
      if (memo) {
        shiftJob.refundMemo = memo;
      }
      shiftJob.updatedAt = new Date().toISOString();

      logger.info({ shiftId, userId, address }, "Refund address updated");

      return res.json({
        success: true,
        shift: updatedShift,
        shiftJob,
      });
    } catch (error: any) {
      logger.error(
        { error, shiftId: req.params.id },
        "Failed to set refund address"
      );

      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          error: error.message || "Failed to set refund address",
          code: error.code,
        });
      }

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

export default router;
