/**
 * Loyalty Routes - User stats and rewards
 * Wave 3 Feature: Volume-based rewards and lifetime tracking
 */

import { Router } from "express";
import { rateLimitConfig } from "../middleware/rateLimit";
import loyalty from "../services/loyalty";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/loyalty/stats/:userId
 * Get user stats and loyalty information
 */
router.get("/stats/:userId", rateLimitConfig.general, async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = loyalty.getUserStats(userId);
    const tierProgress = loyalty.getTierProgress(stats.lifetimeVolumeUsd);

    res.json({
      success: true,
      data: {
        ...stats,
        tier: tierProgress.currentTier,
        nextTier: tierProgress.nextTier,
        progressToNextTier: tierProgress.progressPercent,
        volumeToNextTier: tierProgress.volumeToNextTier,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get user stats");
    res.status(500).json({
      success: false,
      error: "Failed to fetch user stats",
    });
  }
});

/**
 * GET /api/loyalty/tiers
 * Get all loyalty tier definitions
 */
router.get("/tiers", rateLimitConfig.general, (_req, res) => {
  res.json({
    success: true,
    data: loyalty.LOYALTY_TIERS.map((tier) => ({
      ...tier,
      maxVolume: tier.maxVolume === Infinity ? null : tier.maxVolume,
    })),
  });
});

/**
 * POST /api/loyalty/record
 * Record a completed shift (called internally after successful shift)
 */
router.post(
  "/record",
  rateLimitConfig.general,
  async (req, res): Promise<void> => {
    try {
      const { userId, chain, volumeUsd, isTopUp, wasZeroGasRescue } = req.body;

      if (!userId || !chain || volumeUsd === undefined) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: userId, chain, volumeUsd",
        });
        return;
      }

      const stats = loyalty.recordShift(
        userId,
        chain,
        parseFloat(volumeUsd),
        isTopUp || false,
        wasZeroGasRescue || false
      );

      const tierProgress = loyalty.getTierProgress(stats.lifetimeVolumeUsd);

      res.json({
        success: true,
        data: {
          ...stats,
          tier: tierProgress.currentTier,
          nextTier: tierProgress.nextTier,
          progressToNextTier: tierProgress.progressPercent,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to record shift");
      res.status(500).json({
        success: false,
        error: "Failed to record shift",
      });
    }
  }
);

/**
 * POST /api/loyalty/use-free-topup
 * Use a free topup credit
 */
router.post(
  "/use-free-topup",
  rateLimitConfig.general,
  async (req, res): Promise<void> => {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "Missing userId",
        });
        return;
      }

      const success = loyalty.useFreeTopup(userId);

      if (!success) {
        res.status(400).json({
          success: false,
          error: "No free topups available",
        });
        return;
      }

      const stats = loyalty.getUserStats(userId);

      res.json({
        success: true,
        message: "Free topup used successfully",
        data: {
          freeTopupsRemaining: stats.freeTopupsAvailable,
          totalFreeTopupsUsed: stats.freeTopupsUsed,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to use free topup");
      res.status(500).json({
        success: false,
        error: "Failed to use free topup",
      });
    }
  }
);

/**
 * GET /api/loyalty/leaderboard
 * Get top users by volume
 */
router.get("/leaderboard", rateLimitConfig.general, (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = loyalty.getLeaderboard(Math.min(limit, 100));

    res.json({
      success: true,
      data: leaderboard.map((user, index) => ({
        rank: index + 1,
        id: user.id.substring(0, 8) + "...", // Anonymize
        tier: user.currentTier,
        volume: user.lifetimeVolumeUsd,
        shifts: user.totalShifts,
        streakDays: user.streakDays,
      })),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get leaderboard");
    res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard",
    });
  }
});

/**
 * GET /api/loyalty/platform-stats
 * Get global platform statistics
 */
router.get("/platform-stats", rateLimitConfig.general, (_req, res) => {
  try {
    const stats = loyalty.getPlatformStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get platform stats");
    res.status(500).json({
      success: false,
      error: "Failed to fetch platform stats",
    });
  }
});

export default router;
