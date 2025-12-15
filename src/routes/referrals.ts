import { Request, Response, Router } from "express";
import { z } from "zod";
import * as store from "../store/store";
import { logger } from "../utils/logger";
import { authenticateWallet } from "./auth";

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const ApplyReferralSchema = z.object({
  referralCode: z.string().min(4).max(10),
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/referrals
 * Get current user's referral stats and list
 */
router.get("/", authenticateWallet, async (req: Request, res: Response) => {
  try {
    const walletAddress = (req as any).walletAddress;
    const stats = store.getReferralStats(walletAddress);
    const auth = store.getWalletAuth(walletAddress);

    res.json({
      referralCode: stats.referralCode,
      referralLink: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }?ref=${stats.referralCode}`,
      sideshiftLink: `https://sideshift.ai/a/${
        process.env.AFFILIATE_ID || "EKN8DnZ9w"
      }`,
      stats: {
        totalReferrals: stats.totalReferrals,
        activeReferrals: stats.activeReferrals,
        totalVolumeUsd: stats.totalVolume,
        totalCommissionsUsd: stats.totalCommissions,
        commissionRate: "0.5%",
      },
      referredBy: auth?.referredBy || null,
      referrals: stats.referrals.map((r) => ({
        id: r.id,
        referredAddress: `${r.referredAddress.substring(
          0,
          6
        )}...${r.referredAddress.substring(38)}`,
        status: r.status,
        volumeGenerated: r.volumeGenerated,
        commissionsEarned: r.commissionsEarned,
        createdAt: r.createdAt,
        firstShiftAt: r.firstShiftAt,
      })),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get referral stats");
    res.status(500).json({
      error: "Failed to get referral stats",
    });
  }
});

/**
 * POST /api/referrals/apply
 * Apply a referral code (only for users who haven't been referred yet)
 */
router.post(
  "/apply",
  authenticateWallet,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const walletAddress = (req as any).walletAddress;
      const validation = ApplyReferralSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Invalid request",
          details: validation.error.errors,
        });
        return;
      }

      const { referralCode } = validation.data;
      const code = referralCode.toUpperCase();

      // Check if user already has a referrer
      const auth = store.getWalletAuth(walletAddress);
      if (auth?.referredBy) {
        res.status(400).json({
          error: "Already referred",
          message: "You already have a referrer",
        });
        return;
      }

      // Find referrer by code
      const referrer = store.getWalletAuthByReferralCode(code);
      if (!referrer) {
        res.status(404).json({
          error: "Invalid referral code",
          message: "The referral code does not exist",
        });
        return;
      }

      // Can't refer yourself
      if (referrer.id === walletAddress) {
        res.status(400).json({
          error: "Invalid referral",
          message: "You cannot use your own referral code",
        });
        return;
      }

      // Apply referral
      store.updateWalletAuth(walletAddress, { referredBy: code });
      store.createReferral(referrer.walletAddress, walletAddress, code);

      // Log activity
      store.createUserActivity({
        walletAddress,
        type: "referral",
        action: "applied",
        details: { referredBy: referrer.walletAddress, code },
      });

      logger.info(
        {
          referred: walletAddress.substring(0, 10),
          referrer: referrer.id.substring(0, 10),
        },
        "Referral code applied"
      );

      res.json({
        success: true,
        message: "Referral code applied successfully",
        referredBy: code,
      });
    } catch (error) {
      logger.error({ error }, "Failed to apply referral code");
      res.status(500).json({
        error: "Failed to apply referral code",
      });
    }
  }
);

/**
 * GET /api/referrals/code/:code
 * Check if a referral code is valid (public endpoint)
 */
router.get(
  "/code/:code",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.params;
      const auth = store.getWalletAuthByReferralCode(code.toUpperCase());

      if (!auth) {
        res.status(404).json({
          valid: false,
          error: "Referral code not found",
        });
        return;
      }

      // Get referrer stats (limited info for privacy)
      const stats = store.getReferralStats(auth.walletAddress);

      res.json({
        valid: true,
        code: auth.referralCode,
        referrerAddress: `${auth.walletAddress.substring(
          0,
          6
        )}...${auth.walletAddress.substring(38)}`,
        activeReferrals: stats.activeReferrals,
        // Show that this is a real active referrer
        isActive: stats.totalVolume > 0,
      });
    } catch (error) {
      logger.error({ error }, "Failed to check referral code");
      res.status(500).json({
        error: "Failed to check referral code",
      });
    }
  }
);

/**
 * GET /api/referrals/leaderboard
 * Get top referrers (public endpoint)
 */
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const allAuths = store.getAllWalletAuths();
    const leaderboard = allAuths
      .map((auth) => {
        const stats = store.getReferralStats(auth.walletAddress);
        return {
          address: `${auth.walletAddress.substring(
            0,
            6
          )}...${auth.walletAddress.substring(38)}`,
          referralCode: auth.referralCode,
          totalReferrals: stats.totalReferrals,
          activeReferrals: stats.activeReferrals,
          totalVolume: stats.totalVolume,
          totalCommissions: stats.totalCommissions,
        };
      })
      .filter((u) => u.totalReferrals > 0)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, limit);

    res.json({
      leaderboard,
      totalReferrers: leaderboard.length,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get referral leaderboard");
    res.status(500).json({
      error: "Failed to get leaderboard",
    });
  }
});

/**
 * GET /api/referrals/link
 * Get personalized referral links for sharing
 */
router.get(
  "/link",
  authenticateWallet,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const walletAddress = (req as any).walletAddress;
      const auth = store.getWalletAuth(walletAddress);

      if (!auth) {
        res.status(404).json({
          error: "User not found",
        });
        return;
      }

      const code = auth.referralCode;
      const affiliateId = process.env.AFFILIATE_ID || "EKN8DnZ9w";
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

      res.json({
        code,
        links: {
          // OctaneShift referral
          default: `${frontendUrl}?ref=${code}`,
          // With specific page
          topup: `${frontendUrl}/topup?ref=${code}`,
          gas: `${frontendUrl}/gas?ref=${code}`,
          gifts: `${frontendUrl}/gifts?ref=${code}`,
          // SideShift official affiliate link (uses OctaneShift's affiliate ID)
          sideshift: `https://sideshift.ai/a/${affiliateId}`,
          // SideShift with specific pair
          sideshiftBtcEth: `https://sideshift.ai/btc/eth/a/${affiliateId}`,
          sideshiftUsdcEth: `https://sideshift.ai/usdc/eth/a/${affiliateId}`,
        },
        shareMessages: {
          twitter: `Swap crypto instantly with @OctaneShift - no KYC, no hassle! Use my link: ${frontendUrl}?ref=${code}`,
          telegram: `🚀 Need gas on any chain? Use OctaneShift!\n\nFast swaps, no KYC required.\n\n👉 ${frontendUrl}?ref=${code}`,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to get referral links");
      res.status(500).json({
        error: "Failed to get referral links",
      });
    }
  }
);

export default router;
