import { Request } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger";
import { getClientIP } from "./ip";

/**
 * Rate limiting configuration for different endpoints
 */
export const rateLimitConfig = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      type: "about:blank#rate-limit",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many requests from this IP, please try again later.",
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return getClientIP(req);
    },
    handler: (req, res) => {
      const ip = getClientIP(req);
      logger.warn(
        {
          userIp: ip,
          url: req.originalUrl,
          method: req.method,
        },
        "Rate limit exceeded"
      );

      res.status(429);
      res.setHeader("Content-Type", "application/problem+json");
      res.json({
        type: "about:blank#rate-limit",
        title: "Too Many Requests",
        status: 429,
        detail: "Too many requests from this IP, please try again later.",
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"] || `req_${Date.now()}`,
      });
    },
  }),

  // Strict rate limit for sensitive endpoints
  strict: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
      type: "about:blank#rate-limit-strict",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many requests to this endpoint, please try again later.",
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return getClientIP(req);
    },
    handler: (req, res) => {
      const ip = getClientIP(req);
      logger.warn(
        {
          userIp: ip,
          url: req.originalUrl,
          method: req.method,
        },
        "Strict rate limit exceeded"
      );

      res.status(429);
      res.setHeader("Content-Type", "application/problem+json");
      res.json({
        type: "about:blank#rate-limit-strict",
        title: "Too Many Requests",
        status: 429,
        detail: "Too many requests to this endpoint, please try again later.",
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"] || `req_${Date.now()}`,
      });
    },
  }),

  // Very permissive rate limit for health checks
  health: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // limit each IP to 60 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return getClientIP(req);
    },
    skip: (req) => {
      // Skip rate limiting for monitoring services
      const userAgent = req.headers["user-agent"]?.toLowerCase() || "";
      return (
        userAgent.includes("pingdom") ||
        userAgent.includes("uptimerobot") ||
        userAgent.includes("statuspage")
      );
    },
  }),

  // Shift creation rate limit (per user)
  shiftCreation: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each user to 5 shift creations per hour
    message: {
      type: "about:blank#rate-limit-shift",
      title: "Shift Creation Limit Exceeded",
      status: 429,
      detail: "You can only create 5 shifts per hour. Please try again later.",
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use userId if authenticated, otherwise fall back to IP
      const userId = (req as any).userId;
      return userId ? `user:${userId}` : `ip:${getClientIP(req)}`;
    },
    handler: (req, res) => {
      const userId = (req as any).userId;
      const ip = getClientIP(req);
      logger.warn(
        {
          userId,
          userIp: ip,
          url: req.originalUrl,
          method: req.method,
        },
        "Shift creation rate limit exceeded"
      );

      res.status(429);
      res.setHeader("Content-Type", "application/problem+json");
      res.json({
        type: "about:blank#rate-limit-shift",
        title: "Shift Creation Limit Exceeded",
        status: 429,
        detail:
          "You can only create 5 shifts per hour. Please try again later.",
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"] || `req_${Date.now()}`,
        retryAfter: 3600, // seconds
      });
    },
  }),

  // Top-up initiation rate limit (per user)
  topupCreation: rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 10, // limit each user to 10 top-ups per 30 minutes
    message: {
      type: "about:blank#rate-limit-topup",
      title: "Top-up Limit Exceeded",
      status: 429,
      detail:
        "You can only initiate 10 top-ups per 30 minutes. Please try again later.",
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId ? `user:${userId}` : `ip:${getClientIP(req)}`;
    },
    handler: (req, res) => {
      const userId = (req as any).userId;
      const ip = getClientIP(req);
      logger.warn(
        {
          userId,
          userIp: ip,
          url: req.originalUrl,
          method: req.method,
        },
        "Top-up creation rate limit exceeded"
      );

      res.status(429);
      res.setHeader("Content-Type", "application/problem+json");
      res.json({
        type: "about:blank#rate-limit-topup",
        title: "Top-up Limit Exceeded",
        status: 429,
        detail:
          "You can only initiate 10 top-ups per 30 minutes. Please try again later.",
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers["x-request-id"] || `req_${Date.now()}`,
        retryAfter: 1800, // seconds
      });
    },
  }),

  // Watchlist creation rate limit
  watchlistCreation: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each user to 20 watchlist creations per hour
    message: {
      type: "about:blank#rate-limit-watchlist",
      title: "Watchlist Creation Limit Exceeded",
      status: 429,
      detail:
        "You can only create 20 watchlists per hour. Please try again later.",
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId ? `user:${userId}` : `ip:${getClientIP(req)}`;
    },
  }),
};

export default rateLimitConfig;
