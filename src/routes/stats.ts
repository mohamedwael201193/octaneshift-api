import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

// ============================================
// USER STATISTICS
// ============================================

/**
 * GET /api/stats/user
 * Get user's shift statistics
 */
router.get("/user", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    // Get all user's shifts
    const shiftJobs = store.getShiftJobsByUserId(userId);

    // Calculate statistics
    const stats = {
      totalShifts: shiftJobs.length,
      completedShifts: shiftJobs.filter((s) => s.status === "settled").length,
      pendingShifts: shiftJobs.filter((s) =>
        ["waiting", "pending", "processing"].includes(s.status)
      ).length,
      refundedShifts: shiftJobs.filter((s) =>
        ["refunding", "refunded"].includes(s.status)
      ).length,
      fixedShifts: shiftJobs.filter((s) => s.type === "fixed").length,
      variableShifts: shiftJobs.filter((s) => s.type === "variable").length,
      totalDepositAmount: shiftJobs
        .filter((s) => s.depositAmount && s.status === "settled")
        .reduce((sum, s) => sum + parseFloat(s.depositAmount || "0"), 0),
      totalSettleAmount: shiftJobs
        .filter((s) => s.settleAmount && s.status === "settled")
        .reduce((sum, s) => sum + parseFloat(s.settleAmount || "0"), 0),
      recentShifts: shiftJobs
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10),
    };

    // Group by coins
    const depositCoins = new Map<string, number>();
    const settleCoins = new Map<string, number>();

    shiftJobs.forEach((shift) => {
      const depositKey = `${shift.depositCoin}-${shift.depositNetwork}`;
      depositCoins.set(depositKey, (depositCoins.get(depositKey) || 0) + 1);

      const settleKey = `${shift.settleCoin}-${shift.settleNetwork}`;
      settleCoins.set(settleKey, (settleCoins.get(settleKey) || 0) + 1);
    });

    const enrichedStats = {
      ...stats,
      depositCoinBreakdown: Array.from(depositCoins.entries()).map(
        ([coin, count]) => ({ coin, count })
      ),
      settleCoinBreakdown: Array.from(settleCoins.entries()).map(
        ([coin, count]) => ({ coin, count })
      ),
    };

    logger.info(
      { userId, totalShifts: stats.totalShifts },
      "User stats retrieved"
    );

    res.json({
      success: true,
      stats: enrichedStats,
    });
  } catch (error: any) {
    logger.error(
      { error, userId: (req as any).userId },
      "Failed to get user stats"
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// ============================================
// WATCHLIST STATISTICS
// ============================================

/**
 * GET /api/stats/watchlist/:id
 * Get watchlist-specific statistics
 */
router.get("/watchlist/:id", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const watchlistId = req.params.id;

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

    // Get all alerts for this watchlist
    const alerts = store.getAlertsByWatchlistId(watchlistId);

    // Calculate statistics
    const stats = {
      watchlist: {
        id: watchlist.id,
        address: watchlist.address,
        chain: watchlist.chain,
        threshold: watchlist.thresholdNative,
        createdAt: watchlist.createdAt,
      },
      shifts: {
        total: shiftJobs.length,
        completed: shiftJobs.filter((s) => s.status === "settled").length,
        pending: shiftJobs.filter((s) =>
          ["waiting", "pending", "processing"].includes(s.status)
        ).length,
        refunded: shiftJobs.filter((s) =>
          ["refunding", "refunded"].includes(s.status)
        ).length,
        totalSettled: shiftJobs
          .filter((s) => s.settleAmount && s.status === "settled")
          .reduce((sum, s) => sum + parseFloat(s.settleAmount || "0"), 0),
      },
      alerts: {
        total: alerts.length,
        criticalAlerts: alerts.filter((a) => a.level === "critical").length,
        lowAlerts: alerts.filter((a) => a.level === "low").length,
        lastAlertAt: watchlist.lastAlertAt,
      },
      recentActivity: [
        ...shiftJobs.map((s) => ({
          type: "shift",
          id: s.id,
          createdAt: s.createdAt,
          status: s.status,
          settleAmount: s.settleAmount,
        })),
        ...alerts.map((a) => ({
          type: "alert",
          id: a.id,
          sentAt: a.sentAt,
          level: a.level,
        })),
      ]
        .sort((a, b) => {
          const aTime = new Date(
            "createdAt" in a ? a.createdAt : a.sentAt
          ).getTime();
          const bTime = new Date(
            "createdAt" in b ? b.createdAt : b.sentAt
          ).getTime();
          return bTime - aTime;
        })
        .slice(0, 20),
    };

    logger.info(
      { userId, watchlistId, totalShifts: stats.shifts.total },
      "Watchlist stats retrieved"
    );

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error(
      { error, watchlistId: req.params.id },
      "Failed to get watchlist stats"
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// ============================================
// SHIFT PROOF (Extended info)
// ============================================

/**
 * GET /api/stats/shift/:id/proof
 * Get extended shift information including proof/verification data
 */
router.get("/shift/:id/proof", authenticateToken, async (req, res) => {
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

    // Get watchlist if linked
    let watchlist;
    if (shiftJob.watchlistId) {
      watchlist = store.getWatchlist(shiftJob.watchlistId);
    }

    // Build proof/verification data
    const proof = {
      shift: {
        id: shiftJob.shiftId,
        createdAt: shiftJob.createdAt,
        status: shiftJob.status,
        type: shiftJob.type,
        expiresAt: shiftJob.expiresAt,
      },
      deposit: {
        coin: shiftJob.depositCoin,
        network: shiftJob.depositNetwork,
        address: shiftJob.depositAddress,
        amount: shiftJob.depositAmount,
      },
      settlement: {
        coin: shiftJob.settleCoin,
        network: shiftJob.settleNetwork,
        address: shiftJob.settleAddress,
        amount: shiftJob.settleAmount,
      },
      rate: shiftJob.rate,
      txHash: shiftJob.txHash,
      ...(watchlist && {
        watchlist: {
          id: watchlist.id,
          chain: watchlist.chain,
          address: watchlist.address,
        },
      }),
      verification: {
        canVerifyOnChain: shiftJob.status === "settled" && shiftJob.txHash,
        depositExplorerUrl:
          shiftJob.depositNetwork === "ethereum"
            ? `https://etherscan.io/address/${shiftJob.depositAddress}`
            : `https://blockexplorer.one/${shiftJob.depositNetwork}/address/${shiftJob.depositAddress}`,
        settleExplorerUrl:
          shiftJob.settleNetwork === "ethereum"
            ? `https://etherscan.io/address/${shiftJob.settleAddress}`
            : shiftJob.settleNetwork === "base"
            ? `https://basescan.org/address/${shiftJob.settleAddress}`
            : `https://blockexplorer.one/${shiftJob.settleNetwork}/address/${shiftJob.settleAddress}`,
        ...(shiftJob.txHash && {
          txExplorerUrl:
            shiftJob.settleNetwork === "ethereum"
              ? `https://etherscan.io/tx/${shiftJob.txHash}`
              : shiftJob.settleNetwork === "base"
              ? `https://basescan.org/tx/${shiftJob.txHash}`
              : `https://blockexplorer.one/${shiftJob.settleNetwork}/tx/${shiftJob.txHash}`,
        }),
      },
    };

    logger.info(
      { userId, shiftId, status: shiftJob.status },
      "Shift proof retrieved"
    );

    res.json({
      success: true,
      proof,
    });
  } catch (error: any) {
    logger.error(
      { error, shiftId: req.params.id },
      "Failed to get shift proof"
    );
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// ============================================
// SYSTEM STATISTICS (Development only)
// ============================================

if (process.env.NODE_ENV === "development") {
  /**
   * GET /api/stats/system
   * Get system-wide statistics (dev only)
   */
  router.get("/system", async (_req, res) => {
    try {
      const allUsers = store.getAllUsers();
      const allWatchlists = store.getAllWatchlists();
      const allShifts = store.getAllShiftJobs();
      const allAlerts = store.getAllAlerts();

      const stats = {
        users: {
          total: allUsers.length,
        },
        watchlists: {
          total: allWatchlists.length,
          byChain: allWatchlists.reduce((acc, w) => {
            acc[w.chain] = (acc[w.chain] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        shifts: {
          total: allShifts.length,
          completed: allShifts.filter((s) => s.status === "settled").length,
          pending: allShifts.filter((s) =>
            ["waiting", "pending", "processing"].includes(s.status)
          ).length,
          byType: {
            fixed: allShifts.filter((s) => s.type === "fixed").length,
            variable: allShifts.filter((s) => s.type === "variable").length,
          },
        },
        alerts: {
          total: allAlerts.length,
          critical: allAlerts.filter((a) => a.level === "critical").length,
          low: allAlerts.filter((a) => a.level === "low").length,
        },
      };

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      logger.error({ error }, "Failed to get system stats");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  });
}

export default router;
