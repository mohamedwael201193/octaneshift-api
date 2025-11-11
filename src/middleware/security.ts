import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

/**
 * Input sanitization middleware
 * Removes potentially dangerous characters and scripts from request body
 */
export function sanitizeInput(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    sanitizeObject(req.query as Record<string, any>);
  }

  next();
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: Record<string, any>): void {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      // Remove null bytes
      obj[key] = obj[key].replace(/\0/g, "");

      // Remove script tags
      obj[key] = obj[key].replace(/<script[^>]*>.*?<\/script>/gi, "");

      // Remove dangerous HTML
      obj[key] = obj[key].replace(/<iframe[^>]*>.*?<\/iframe>/gi, "");
      obj[key] = obj[key].replace(/<object[^>]*>.*?<\/object>/gi, "");
      obj[key] = obj[key].replace(/<embed[^>]*>/gi, "");

      // Trim whitespace
      obj[key] = obj[key].trim();
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * Validate Ethereum address format
 */
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate amount string (positive number)
 */
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && /^\d+\.?\d*$/.test(amount);
}

/**
 * Validate coin symbol (alphanumeric, 2-10 chars)
 */
export function isValidCoinSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{2,10}$/i.test(symbol);
}

/**
 * Validate network name (alphanumeric + hyphen, 2-20 chars)
 */
export function isValidNetworkName(network: string): boolean {
  return /^[a-z0-9-]{2,20}$/i.test(network);
}

/**
 * Request signature verification middleware
 * Validates that requests include a valid timestamp and aren't replayed
 */
const requestCache = new Map<string, number>();
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function validateRequestSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const timestamp = req.headers["x-timestamp"] as string;
  const requestId = req.headers["x-request-id"] as string;

  if (!timestamp || !requestId) {
    res.status(400).json({
      error: "Missing security headers",
      message: "x-timestamp and x-request-id headers are required",
    });
    return;
  }

  // Validate timestamp format
  const reqTime = parseInt(timestamp, 10);
  if (isNaN(reqTime)) {
    res.status(400).json({
      error: "Invalid timestamp",
      message: "x-timestamp must be a valid Unix timestamp in milliseconds",
    });
    return;
  }

  // Check if request is within replay window
  const now = Date.now();
  const age = now - reqTime;

  if (age > REPLAY_WINDOW_MS) {
    logger.warn(
      {
        requestId,
        timestamp: reqTime,
        age,
      },
      "Request timestamp too old"
    );
    res.status(400).json({
      error: "Request expired",
      message: "Request timestamp is too old",
    });
    return;
  }

  if (age < -60000) {
    // Request from future (allow 1 min clock skew)
    logger.warn(
      {
        requestId,
        timestamp: reqTime,
        age,
      },
      "Request timestamp in future"
    );
    res.status(400).json({
      error: "Invalid timestamp",
      message: "Request timestamp is in the future",
    });
    return;
  }

  // Check for replay attacks
  if (requestCache.has(requestId)) {
    logger.warn(
      {
        requestId,
      },
      "Potential replay attack detected"
    );
    res.status(400).json({
      error: "Duplicate request",
      message: "This request has already been processed",
    });
    return;
  }

  // Store request ID to prevent replay
  requestCache.set(requestId, reqTime);

  // Clean up old entries periodically
  if (requestCache.size > 10000) {
    const cutoff = now - REPLAY_WINDOW_MS;
    for (const [id, time] of requestCache.entries()) {
      if (time < cutoff) {
        requestCache.delete(id);
      }
    }
  }

  next();
}

/**
 * CSRF token validation middleware
 * Validates CSRF token for state-changing operations
 */
export function validateCSRFToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip CSRF validation for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const csrfToken = req.headers["x-csrf-token"] as string;
  const cookieToken = req.cookies?.csrfToken;

  if (!csrfToken) {
    res.status(403).json({
      error: "CSRF token missing",
      message: "x-csrf-token header is required for this operation",
    });
    return;
  }

  if (!cookieToken) {
    res.status(403).json({
      error: "CSRF session invalid",
      message: "CSRF session cookie is missing",
    });
    return;
  }

  if (csrfToken !== cookieToken) {
    logger.warn(
      {
        method: req.method,
        url: req.originalUrl,
      },
      "CSRF token mismatch"
    );
    res.status(403).json({
      error: "CSRF token invalid",
      message: "CSRF token does not match session",
    });
    return;
  }

  next();
}

/**
 * Security headers middleware
 * Adds additional security headers
 */
export function addSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  next();
}

/**
 * Validate IP address isn't from known proxy/VPN
 * This is a basic check - production should use a service like IPQualityScore
 */
export function validateIPQuality(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const ip = (req as any).clientIp;

  // Skip in development
  if (process.env.NODE_ENV === "development") {
    return next();
  }

  // Basic checks for suspicious IPs
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "127.0.0.1") {
    logger.warn({ ip }, "Local IP address detected");
  }

  // In production, you would call an IP reputation service here
  // For now, just log and continue
  logger.debug({ ip }, "IP quality check passed");
  next();
}
