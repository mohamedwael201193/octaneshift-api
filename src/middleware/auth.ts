import { NextFunction, Request, Response } from "express";
import * as store from "../store/store";
import { logger } from "../utils/logger";

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Lightweight Bearer token authentication middleware
 * Validates token format and checks if user exists in store
 * Token format: "Bearer <userId>"
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: "Authorization header required",
        message: "Please provide a Bearer token in Authorization header",
      });
      return;
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        error: "Invalid authorization format",
        message: 'Expected format: "Bearer <token>"',
      });
      return;
    }

    const token = parts[1];

    if (!token || token.trim() === "") {
      res.status(401).json({
        error: "Invalid token",
        message: "Token cannot be empty",
      });
      return;
    }

    // For lightweight auth, the token is the userId (or wallet address)
    const userId = token.toLowerCase(); // Normalize wallet addresses

    // Check if user exists in store (legacy user) OR has valid wallet auth
    const user = store.getUser(userId);
    const walletAuth = store.getWalletAuth(userId);

    if (!user && !walletAuth) {
      // Auto-create wallet auth for Ethereum addresses
      if (userId.startsWith("0x") && userId.length === 42) {
        store.createWalletAuth(userId);
        logger.info({ userId }, "Auto-created wallet auth for new user");
      } else {
        res.status(401).json({
          error: "Invalid token",
          message: "User not found or token expired",
        });
        return;
      }
    }

    // Attach userId to request for downstream handlers
    req.userId = userId;

    logger.debug({ userId }, "User authenticated successfully");
    next();
  } catch (error) {
    logger.error({ error }, "Authentication error");
    res.status(500).json({
      error: "Authentication failed",
      message: "Internal server error during authentication",
    });
  }
}

/**
 * Optional authentication middleware
 * Extracts userId if token is provided, but doesn't require it
 */
export function optionalAuth(
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

    if (parts.length === 2 && parts[0] === "Bearer") {
      const token = parts[1];

      if (token && token.trim() !== "") {
        const userId = token.toLowerCase();
        const user = store.getUser(userId);
        const walletAuth = store.getWalletAuth(userId);

        if (user || walletAuth) {
          req.userId = userId;
          logger.debug({ userId }, "Optional auth: User identified");
        }
      }
    }

    next();
  } catch (error) {
    logger.error({ error }, "Optional authentication error");
    next(); // Don't fail on optional auth
  }
}
