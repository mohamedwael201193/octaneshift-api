import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

/**
 * Admin authentication middleware
 * Validates admin API key from environment variable
 */
export function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminKey = process.env.ADMIN_API_KEY;

  // If no admin key is configured, reject all admin requests
  if (!adminKey) {
    logger.warn("Admin API key not configured");
    res.status(503).json({
      error: "Admin API not available",
      message: "Admin functionality is not configured on this server",
    });
    return;
  }

  // Get API key from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Admin API key required",
    });
    return;
  }

  const providedKey = authHeader.substring(7); // Remove "Bearer " prefix

  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== adminKey.length) {
    logger.warn(
      {
        ip: req.ip,
        path: req.path,
      },
      "Invalid admin API key length"
    );
    res.status(403).json({
      error: "Forbidden",
      message: "Invalid admin API key",
    });
    return;
  }

  // Use crypto for timing-safe comparison
  const crypto = require("crypto");
  const providedBuffer = Buffer.from(providedKey, "utf8");
  const adminBuffer = Buffer.from(adminKey, "utf8");

  try {
    if (!crypto.timingSafeEqual(providedBuffer, adminBuffer)) {
      logger.warn(
        {
          ip: req.ip,
          path: req.path,
        },
        "Invalid admin API key"
      );
      res.status(403).json({
        error: "Forbidden",
        message: "Invalid admin API key",
      });
      return;
    }
  } catch (error) {
    logger.error({ error }, "Error comparing admin API keys");
    res.status(500).json({
      error: "Internal server error",
    });
    return;
  }

  // Admin authenticated successfully
  logger.info(
    {
      ip: req.ip,
      path: req.path,
      method: req.method,
    },
    "Admin request authenticated"
  );

  next();
}
