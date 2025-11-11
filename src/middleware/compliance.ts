import { NextFunction, Request, Response } from "express";
import sideshift, { SideShiftError } from "../lib/sideshift";
import * as store from "../store/store";
import { logger } from "../utils/logger";
import { APIError } from "./errors";

export interface PermissionCheckResult {
  createShift: boolean;
  affiliate?: boolean;
  requestQuote?: boolean;
  country?: string;
  restricted?: boolean;
}

/**
 * Transaction limits based on user verification level
 */
export const TRANSACTION_LIMITS = {
  unverified: {
    perShift: 1000, // $1000 per shift
    daily: 2000, // $2000 per day
    monthly: 10000, // $10000 per month
  },
  basicKYC: {
    perShift: 5000, // $5000 per shift
    daily: 10000, // $10000 per day
    monthly: 50000, // $50000 per month
  },
  fullKYC: {
    perShift: 50000, // $50000 per shift
    daily: 100000, // $100000 per day
    monthly: 500000, // $500000 per month
  },
};

/**
 * Compliance middleware that checks user permissions with SideShift
 * Returns 451 Unavailable For Legal Reasons if user is restricted
 */
export async function checkPermissions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userIp = (req as any).userIp || "unknown";

    // Skip permission check in demo mode for non-mutating operations
    const isDemoMode = process.env.DEMO_MODE === "true";
    const isReadOnlyOperation =
      req.method === "GET" && req.path.includes("/pair");

    if (isDemoMode && isReadOnlyOperation) {
      logger.debug(
        { userIp: maskIp(userIp) },
        "Skipping permission check in demo mode"
      );
      next();
      return;
    }

    logger.debug({ userIp: maskIp(userIp) }, "Checking user permissions");

    // Call SideShift to check permissions
    const permissions = await sideshift.getPermissions(userIp);

    // Check if user is restricted (no createShift permission typically means restricted)
    if (!permissions.createShift) {
      logger.warn(
        {
          userIp: maskIp(userIp),
          permissions,
          path: req.path,
          method: req.method,
        },
        "User access restricted by region"
      );

      // Return 451 Unavailable For Legal Reasons
      res.status(451);
      res.setHeader("Content-Type", "application/problem+json");
      res.json({
        type: "about:blank#region-restricted",
        title: "Unavailable For Legal Reasons",
        status: 451,
        detail: "Not available in your region.",
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"] || `req_${Date.now()}`,
        restricted: true,
        country: (permissions as any).country || "unknown",
        message: "Not available in your region.",
      });
      return;
    }

    // Store permissions in request for potential later use
    (req as any).userPermissions = permissions;

    logger.debug(
      {
        userIp: maskIp(userIp),
        hasCreateShift: permissions.createShift,
        hasAffiliate: permissions.affiliate,
      },
      "User permissions verified"
    );

    next();
  } catch (error) {
    if (error instanceof SideShiftError) {
      // If SideShift API is down or returns an error, we'll allow the request to proceed
      // but log the issue for monitoring
      logger.warn(
        {
          error: {
            status: error.status,
            message: error.message,
            code: error.code,
          },
          userIp: maskIp((req as any).userIp || "unknown"),
          path: req.path,
        },
        "Permission check failed, allowing request to proceed"
      );

      next();
    } else {
      logger.error(
        {
          error,
          userIp: maskIp((req as any).userIp || "unknown"),
          path: req.path,
        },
        "Unexpected error in permission check"
      );

      next(
        new APIError(
          500,
          "Permission Check Failed",
          "Unable to verify user permissions"
        )
      );
    }
  }
}

/**
 * Mask IP address for logging (hide last octet for IPv4)
 */
function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return ip;

  // Handle IPv4 addresses
  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }

  // Handle IPv6 addresses (mask last 4 characters)
  if (ip.includes(":")) {
    if (ip.length > 4) {
      return ip.slice(0, -4) + "****";
    }
  }

  // Fallback: mask last 4 characters
  if (ip.length > 4) {
    return ip.slice(0, -4) + "****";
  }

  return "****";
}

/**
 * Mask wallet address for logging (hide last 6 characters)
 */
export function maskWalletAddress(address: string): string {
  if (!address || address.length <= 6) {
    return "******";
  }

  return address.slice(0, -6) + "******";
}

/**
 * Validate transaction amount against user limits
 */
export async function validateTransactionLimits(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).userId;

    if (!userId) {
      return next();
    }

    // Get user
    const user = store.getUser(userId);
    if (!user) {
      return next();
    }

    // Determine verification level (default to unverified)
    const verificationLevel = (user as any).verificationLevel || "unverified";
    const limits =
      TRANSACTION_LIMITS[
        verificationLevel as keyof typeof TRANSACTION_LIMITS
      ] || TRANSACTION_LIMITS.unverified;

    // Get shift amount from request
    let shiftAmount = 0;

    // Check different request formats
    if (req.body.depositAmount) {
      shiftAmount = parseFloat(req.body.depositAmount);
    } else if (req.body.settleAmount) {
      shiftAmount = parseFloat(req.body.settleAmount);
    }

    // If no amount specified, skip check (variable shifts)
    if (!shiftAmount || isNaN(shiftAmount)) {
      return next();
    }

    // Assume USDT/USD pricing for simplicity
    const estimatedUSD = shiftAmount;

    // Check per-shift limit
    if (estimatedUSD > limits.perShift) {
      logger.warn(
        {
          userId: maskWalletAddress(userId),
          verificationLevel,
          amount: estimatedUSD,
          limit: limits.perShift,
        },
        "Shift amount exceeds per-shift limit"
      );

      res.status(400).json({
        error: "Amount exceeds limit",
        message: `Your verification level allows up to $${limits.perShift} per shift. Please verify your account for higher limits.`,
        currentLimit: limits.perShift,
        requestedAmount: estimatedUSD,
        verificationLevel,
        upgradeRequired:
          verificationLevel === "unverified" ? "basicKYC" : "fullKYC",
      });
      return;
    }

    // Get user's shifts from today for daily limit check
    const userShifts = store.getShiftJobsByUserId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayShifts = userShifts.filter(
      (shift) => new Date(shift.createdAt) >= today
    );

    // Calculate today's total (rough estimate)
    const todayTotal = todayShifts.reduce((sum, _shift) => {
      // This is a rough estimate - in production you'd track actual USD amounts
      return sum + 100; // Assume average $100 per shift
    }, 0);

    if (todayTotal + estimatedUSD > limits.daily) {
      logger.warn(
        {
          userId: maskWalletAddress(userId),
          verificationLevel,
          todayTotal,
          newAmount: estimatedUSD,
          limit: limits.daily,
        },
        "Daily limit would be exceeded"
      );

      res.status(400).json({
        error: "Daily limit exceeded",
        message: `Your verification level allows up to $${limits.daily} per day. Current usage: $${todayTotal}`,
        dailyLimit: limits.daily,
        dailyUsed: todayTotal,
        dailyRemaining: limits.daily - todayTotal,
        verificationLevel,
      });
      return;
    }

    // Add compliance info to request
    (req as any).compliance = {
      verificationLevel,
      limits,
      estimatedUSD,
      dailyUsed: todayTotal,
    };

    // Log compliance check
    logger.debug(
      {
        userId: maskWalletAddress(userId),
        verificationLevel,
        amount: estimatedUSD,
        dailyUsed: todayTotal,
        dailyRemaining: limits.daily - todayTotal,
      },
      "Transaction limits validated"
    );

    next();
  } catch (error) {
    logger.error({ error }, "Error validating transaction limits");
    next(); // Don't block on errors
  }
}

/**
 * Require KYC for high-value shifts
 */
export function requireKYCForHighValue(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const compliance = (req as any).compliance;

  if (!compliance) {
    return next();
  }

  const { verificationLevel, estimatedUSD } = compliance;
  const userId = (req as any).userId;

  // Require at least basic KYC for shifts over $1000
  if (estimatedUSD > 1000 && verificationLevel === "unverified") {
    logger.warn(
      {
        userId: maskWalletAddress(userId),
        amount: estimatedUSD,
        reason: "kyc_required_high_value",
      },
      "KYC required for high-value shift"
    );

    res.status(403).json({
      error: "KYC required",
      message:
        "Shifts over $1000 require identity verification. Please complete KYC to proceed.",
      amount: estimatedUSD,
      threshold: 1000,
      verificationLevel,
      kycUrl: `${
        process.env.APP_BASE_URL || "https://octaneshift.com"
      }/kyc/start`,
    });
    return;
  }

  // Require full KYC for shifts over $10000
  if (estimatedUSD > 10000 && verificationLevel !== "fullKYC") {
    logger.warn(
      {
        userId: maskWalletAddress(userId),
        amount: estimatedUSD,
        reason: "full_kyc_required_very_high_value",
      },
      "Full KYC required for very high-value shift"
    );

    res.status(403).json({
      error: "Full KYC required",
      message:
        "Shifts over $10,000 require enhanced identity verification. Please complete full KYC to proceed.",
      amount: estimatedUSD,
      threshold: 10000,
      verificationLevel,
      kycUrl: `${
        process.env.APP_BASE_URL || "https://octaneshift.com"
      }/kyc/upgrade`,
    });
    return;
  }

  next();
}

export { maskIp };
