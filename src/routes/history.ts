import { Request, Response, Router } from "express";
import { z } from "zod";
import * as store from "../store/store";
import { logger } from "../utils/logger";
import { authenticateWallet } from "./auth";

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const GetHistoryQuerySchema = z.object({
  type: z.enum(["shift", "topup", "gift", "referral", "all"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/history
 * Get user's activity history
 */
router.get(
  "/",
  authenticateWallet,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const walletAddress = (req as any).walletAddress;

      const queryValidation = GetHistoryQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        res.status(400).json({
          error: "Invalid query parameters",
          details: queryValidation.error.errors,
        });
        return;
      }

      const { type, limit = 50, offset = 0 } = queryValidation.data;

      // Get activities based on type filter
      const activities = store.getUserActivities(walletAddress, {
        type: type === "all" ? undefined : type,
        limit,
        offset,
      });

      // Get stats
      const stats = store.getUserActivityStats(walletAddress);

      res.json({
        activities: activities.map((a) => ({
          id: a.id,
          type: a.type,
          action: a.action,
          chain: a.chain,
          amount: a.amount,
          amountUsd: a.amountUsd,
          txHash: a.txHash,
          details: a.details,
          createdAt: a.createdAt,
        })),
        pagination: {
          offset,
          limit,
          hasMore: activities.length === limit,
        },
        stats,
      });
    } catch (error) {
      logger.error({ error }, "Failed to get history");
      res.status(500).json({
        error: "Failed to get history",
      });
    }
  }
);

/**
 * GET /api/history/shifts
 * Get user's shift history with full details
 */
router.get(
  "/shifts",
  authenticateWallet,
  async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Get shift jobs for this user
      const shifts = store
        .getShiftJobsByUserId(walletAddress)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(offset, offset + limit);

      const total = store.getShiftJobsByUserId(walletAddress).length;

      res.json({
        shifts: shifts.map((s) => ({
          id: s.id,
          shiftId: s.shiftId,
          status: s.status,
          type: s.type,
          depositCoin: s.depositCoin,
          depositNetwork: s.depositNetwork,
          depositAmount: s.depositAmount,
          settleCoin: s.settleCoin,
          settleNetwork: s.settleNetwork,
          settleAmount: s.settleAmount,
          settleAddress: s.settleAddress
            ? `${s.settleAddress.substring(
                0,
                10
              )}...${s.settleAddress.substring(s.settleAddress.length - 6)}`
            : null,
          depositAddress: s.depositAddress
            ? `${s.depositAddress.substring(
                0,
                10
              )}...${s.depositAddress.substring(s.depositAddress.length - 6)}`
            : null,
          rate: s.rate,
          txHash: s.txHash,
          expiresAt: s.expiresAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        pagination: {
          total,
          offset,
          limit,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to get shift history");
      res.status(500).json({
        error: "Failed to get shift history",
      });
    }
  }
);

/**
 * GET /api/history/stats
 * Get comprehensive stats for the user
 */
router.get(
  "/stats",
  authenticateWallet,
  async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;

      // Activity stats
      const activityStats = store.getUserActivityStats(walletAddress);

      // Loyalty stats
      const loyaltyStats = store.getLoyaltyStats(walletAddress);

      // Referral stats
      const referralStats = store.getReferralStats(walletAddress);

      // Shift stats
      const shifts = store.getShiftJobsByUserId(walletAddress);
      const shiftsByStatus = shifts.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Chain stats from shifts
      const chainStats = shifts.reduce((acc, s) => {
        const chain = s.settleNetwork;
        if (!acc[chain]) {
          acc[chain] = { count: 0, volume: 0 };
        }
        acc[chain].count++;
        if (s.settleAmount) {
          acc[chain].volume += parseFloat(s.settleAmount);
        }
        return acc;
      }, {} as Record<string, { count: number; volume: number }>);

      // Get favorite chain
      const favoriteChain = Object.entries(chainStats).sort(
        (a, b) => b[1].count - a[1].count
      )[0]?.[0];

      // Calculate 24h activity
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = shifts.filter(
        (s) => new Date(s.createdAt).getTime() > oneDayAgo
      );

      res.json({
        overview: {
          totalShifts: activityStats.totalShifts,
          totalTopUps: activityStats.totalTopUps,
          totalGifts: activityStats.totalGifts,
          totalVolumeUsd: activityStats.totalVolumeUsd,
          lastActive: activityStats.lastActive,
        },
        shifts: {
          total: shifts.length,
          byStatus: shiftsByStatus,
          last24h: recent.length,
        },
        chains: {
          stats: chainStats,
          favorite: favoriteChain || null,
        },
        loyalty: loyaltyStats
          ? {
              tier: loyaltyStats.currentTier,
              lifetimeVolume: loyaltyStats.lifetimeVolumeUsd,
              streak: loyaltyStats.streakDays,
              freeTopupsAvailable: loyaltyStats.freeTopupsAvailable,
            }
          : null,
        referrals: {
          total: referralStats.totalReferrals,
          active: referralStats.activeReferrals,
          volume: referralStats.totalVolume,
          commissions: referralStats.totalCommissions,
        },
        joinedAt: loyaltyStats?.joinedAt || null,
      });
    } catch (error) {
      logger.error({ error }, "Failed to get stats");
      res.status(500).json({
        error: "Failed to get stats",
      });
    }
  }
);

/**
 * GET /api/history/export
 * Export user's full history as JSON
 */
router.get(
  "/export",
  authenticateWallet,
  async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;

      // Get all data for this user
      const activities = store.getUserActivities(walletAddress, {
        limit: 10000,
      });
      const shifts = store.getShiftJobsByUserId(walletAddress);
      const watchlists = store.getWatchlistsByUserId(walletAddress);
      const presets = store.getPresetsByUserId(walletAddress);
      const loyaltyStats = store.getLoyaltyStats(walletAddress);
      const referralStats = store.getReferralStats(walletAddress);
      const auth = store.getWalletAuth(walletAddress);

      const exportData = {
        exportedAt: new Date().toISOString(),
        walletAddress: auth?.walletAddress,
        referralCode: auth?.referralCode,
        createdAt: auth?.createdAt,
        data: {
          shifts: shifts.map((s) => ({
            ...s,
            // Remove sensitive addresses from full export
            settleAddress: `${s.settleAddress.substring(0, 10)}...`,
            depositAddress: `${s.depositAddress.substring(0, 10)}...`,
          })),
          watchlists,
          presets,
          activities: activities.slice(0, 1000), // Limit to prevent huge exports
        },
        stats: {
          loyalty: loyaltyStats,
          referrals: {
            code: referralStats.referralCode,
            totalReferrals: referralStats.totalReferrals,
            totalVolume: referralStats.totalVolume,
            totalCommissions: referralStats.totalCommissions,
          },
        },
      };

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="octaneshift-export-${walletAddress.substring(
          0,
          8
        )}-${Date.now()}.json"`
      );
      res.setHeader("Content-Type", "application/json");
      res.json(exportData);
    } catch (error) {
      logger.error({ error }, "Failed to export history");
      res.status(500).json({
        error: "Failed to export history",
      });
    }
  }
);

/**
 * GET /api/history/summary
 * Get a quick summary (for dashboard widgets)
 */
router.get(
  "/summary",
  authenticateWallet,
  async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;

      // Recent shifts (last 5)
      const recentShifts = store
        .getShiftJobsByUserId(walletAddress)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5)
        .map((s) => ({
          id: s.shiftId,
          status: s.status,
          from: `${s.depositCoin}-${s.depositNetwork}`,
          to: `${s.settleCoin}-${s.settleNetwork}`,
          amount: s.depositAmount,
          createdAt: s.createdAt,
        }));

      // Pending shifts count
      const pendingShifts = store
        .getShiftJobsByUserId(walletAddress)
        .filter((s) =>
          ["waiting", "pending", "processing"].includes(s.status)
        ).length;

      // 24h stats
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const shifts24h = store
        .getShiftJobsByUserId(walletAddress)
        .filter((s) => new Date(s.createdAt).getTime() > oneDayAgo);

      res.json({
        recentShifts,
        pendingShifts,
        last24h: {
          shifts: shifts24h.length,
          settled: shifts24h.filter((s) => s.status === "settled").length,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to get summary");
      res.status(500).json({
        error: "Failed to get summary",
      });
    }
  }
);

export default router;
