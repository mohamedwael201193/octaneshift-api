import { ethers } from "ethers";
import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const GetNonceSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
});

const VerifySignatureSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address"),
  signature: z.string().min(1),
  referralCode: z.string().optional(),
});

// ============================================
// WALLET AUTH MIDDLEWARE
// ============================================

/**
 * Middleware to verify wallet authentication via Bearer token
 * Token format: "Bearer <walletAddress>"
 */
export function authenticateWallet(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: "Authorization required",
        message: "Please connect your wallet to access this resource",
      });
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        error: "Invalid authorization format",
        message: 'Expected format: "Bearer <walletAddress>"',
      });
      return;
    }

    const walletAddress = parts[1].toLowerCase();

    // Verify address format
    if (!ethers.isAddress(walletAddress)) {
      res.status(401).json({
        error: "Invalid wallet address",
        message: "Please provide a valid EVM wallet address",
      });
      return;
    }

    // Check if wallet is authenticated
    let auth = store.getWalletAuth(walletAddress);

    // Auto-create and authenticate valid wallet addresses (after server restart)
    if (!auth) {
      auth = store.createWalletAuth(walletAddress);
      store.updateWalletAuth(walletAddress, {
        isAuthenticated: true,
        lastAuthAt: new Date().toISOString(),
      });
      logger.info(
        { walletAddress },
        "Auto-authenticated wallet after server restart"
      );
    } else if (!auth.isAuthenticated) {
      // Re-authenticate existing but unauthenticated wallet
      store.updateWalletAuth(walletAddress, {
        isAuthenticated: true,
        lastAuthAt: new Date().toISOString(),
      });
      logger.info({ walletAddress }, "Re-authenticated wallet");
    }

    // Attach wallet address to request
    (req as any).walletAddress = walletAddress;
    (req as any).userId = walletAddress; // For backwards compatibility

    logger.debug({ walletAddress }, "Wallet authenticated");
    next();
  } catch (error) {
    logger.error({ error }, "Wallet authentication error");
    res.status(500).json({
      error: "Authentication failed",
      message: "Internal server error during authentication",
    });
  }
}

/**
 * Optional wallet authentication - extracts wallet if provided but doesn't require it
 */
export function optionalWalletAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      next();
      return;
    }

    const walletAddress = parts[1].toLowerCase();

    if (ethers.isAddress(walletAddress)) {
      const auth = store.getWalletAuth(walletAddress);
      if (auth && auth.isAuthenticated) {
        (req as any).walletAddress = walletAddress;
        (req as any).userId = walletAddress;
      }
    }

    next();
  } catch (error) {
    next();
  }
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/auth/nonce
 * Get a nonce to sign for wallet authentication
 */
router.post("/nonce", async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = GetNonceSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
      return;
    }

    const { walletAddress } = validation.data;

    // Create or get existing wallet auth with fresh nonce
    const auth = store.createWalletAuth(walletAddress);

    // Save immediately to persist new wallet auth
    await store.save();

    logger.info(
      { walletAddress: walletAddress.substring(0, 10) + "..." },
      "Nonce generated for wallet authentication"
    );

    res.json({
      nonce: auth.nonce,
      expiresAt: auth.nonceExpiresAt,
      isNewUser: !auth.lastAuthAt,
    });
  } catch (error) {
    logger.error({ error }, "Failed to generate nonce");
    res.status(500).json({
      error: "Failed to generate nonce",
      message: "Please try again",
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify signature and authenticate wallet
 */
router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = VerifySignatureSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
      return;
    }

    const { walletAddress, signature, referralCode } = validation.data;
    const addr = walletAddress.toLowerCase();

    // Get wallet auth record
    const auth = store.getWalletAuth(addr);
    if (!auth) {
      res.status(400).json({
        error: "No nonce found",
        message: "Please request a nonce first",
      });
      return;
    }

    // Check nonce expiration
    if (Date.now() > auth.nonceExpiresAt) {
      res.status(400).json({
        error: "Nonce expired",
        message: "Please request a new nonce",
      });
      return;
    }

    // Verify signature
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(auth.nonce, signature);
    } catch (e) {
      res.status(400).json({
        error: "Invalid signature",
        message: "Failed to verify signature",
      });
      return;
    }

    // Check if recovered address matches
    if (recoveredAddress.toLowerCase() !== addr) {
      res.status(401).json({
        error: "Signature mismatch",
        message: "Signature does not match the wallet address",
      });
      return;
    }

    // Mark as authenticated
    const isFirstAuth = !auth.lastAuthAt;
    store.updateWalletAuth(addr, {
      isAuthenticated: true,
      lastAuthAt: new Date().toISOString(),
      nonce: "", // Clear nonce after use
    });

    // Handle referral code for new users
    let referralApplied = false;
    if (isFirstAuth && referralCode) {
      const referrer = store.getWalletAuthByReferralCode(referralCode);
      if (referrer && referrer.id !== addr) {
        // Apply referral
        store.updateWalletAuth(addr, { referredBy: referralCode });
        store.createReferral(
          referrer.walletAddress,
          walletAddress,
          referralCode
        );
        referralApplied = true;

        // Log referral activity
        store.createUserActivity({
          walletAddress: addr,
          type: "referral",
          action: "joined",
          details: { referredBy: referrer.walletAddress, code: referralCode },
        });

        logger.info(
          {
            referred: addr.substring(0, 10),
            referrer: referrer.id.substring(0, 10),
          },
          "Referral applied"
        );
      }
    }

    // Get or create user in main users table for backwards compatibility
    let user = store.getUser(addr);
    if (!user) {
      user = store.createUser({}, addr); // Pass wallet address as custom ID
    }

    // Ensure loyalty stats exist
    store.createLoyaltyStats(addr);

    // Get updated auth
    const updatedAuth = store.getWalletAuth(addr)!;

    // Save immediately to persist authentication state
    await store.save();

    logger.info(
      { walletAddress: addr.substring(0, 10) + "...", isFirstAuth },
      "Wallet authenticated successfully"
    );

    res.json({
      success: true,
      walletAddress,
      referralCode: updatedAuth.referralCode,
      isNewUser: isFirstAuth,
      referralApplied,
      referralLink: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }?ref=${updatedAuth.referralCode}`,
      sideshiftReferralLink: `https://sideshift.ai/a/${
        process.env.AFFILIATE_ID || "EKN8DnZ9w"
      }`,
    });
  } catch (error) {
    logger.error({ error }, "Failed to verify signature");
    res.status(500).json({
      error: "Verification failed",
      message: "Please try again",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get(
  "/me",
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

      const stats = store.getUserActivityStats(walletAddress);
      const referralStats = store.getReferralStats(walletAddress);
      const loyaltyStats = store.getLoyaltyStats(walletAddress);

      res.json({
        walletAddress: auth.walletAddress,
        referralCode: auth.referralCode,
        referralLink: `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }?ref=${auth.referralCode}`,
        referredBy: auth.referredBy,
        createdAt: auth.createdAt,
        lastAuthAt: auth.lastAuthAt,
        stats,
        referralStats: {
          totalReferrals: referralStats.totalReferrals,
          activeReferrals: referralStats.activeReferrals,
          totalVolume: referralStats.totalVolume,
          totalCommissions: referralStats.totalCommissions,
        },
        loyalty: loyaltyStats
          ? {
              currentTier: loyaltyStats.currentTier,
              lifetimeVolumeUsd: loyaltyStats.lifetimeVolumeUsd,
              totalShifts: loyaltyStats.totalShifts,
              streakDays: loyaltyStats.streakDays,
            }
          : null,
      });
    } catch (error) {
      logger.error({ error }, "Failed to get user info");
      res.status(500).json({
        error: "Failed to get user info",
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Log out (clear authentication)
 */
router.post(
  "/logout",
  authenticateWallet,
  async (req: Request, res: Response) => {
    try {
      const walletAddress = (req as any).walletAddress;

      store.updateWalletAuth(walletAddress, {
        isAuthenticated: false,
      });

      logger.info(
        { walletAddress: walletAddress.substring(0, 10) + "..." },
        "Wallet logged out"
      );

      res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      logger.error({ error }, "Failed to logout");
      res.status(500).json({
        error: "Logout failed",
      });
    }
  }
);

/**
 * GET /api/auth/check
 * Check if wallet is authenticated (no auth required)
 */
router.get(
  "/check/:walletAddress",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { walletAddress } = req.params;

      if (!ethers.isAddress(walletAddress)) {
        res.status(400).json({
          error: "Invalid wallet address",
        });
        return;
      }

      const auth = store.getWalletAuth(walletAddress.toLowerCase());

      res.json({
        isAuthenticated: auth?.isAuthenticated || false,
        hasAccount: !!auth,
      });
    } catch (error) {
      logger.error({ error }, "Failed to check auth status");
      res.status(500).json({
        error: "Failed to check auth status",
      });
    }
  }
);

export default router;
