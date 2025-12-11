import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

// Fallback IP for development/localhost (Google DNS - safe public IP)
const DEV_FALLBACK_IP = "8.8.8.8";

declare global {
  namespace Express {
    interface Request {
      userIp?: string;
      clientIp?: string;
    }
  }
}

/**
 * Check if the IP is a localhost/private IP that SideShift will reject
 */
function isLocalhostOrPrivateIP(ip: string | undefined): boolean {
  if (!ip || ip === "unknown") return true;

  // Check for localhost variants
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;

  // Check for private IP ranges
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.")
  )
    return true;

  return false;
}

/**
 * Extract client IP address from various headers and connection info
 * Prioritizes x-forwarded-for header (for proxy setups like Render)
 * Falls back to req.ip as last resort
 * In development mode, uses a fallback public IP for localhost requests
 */
export function extractClientIP(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    let clientIP: string | undefined;

    // Check x-forwarded-for header (most common in proxy environments)
    const xForwardedFor = req.headers["x-forwarded-for"];
    if (xForwardedFor) {
      // x-forwarded-for can be a comma-separated list of IPs
      // The first IP is the original client IP
      const ips = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor;
      clientIP = ips.split(",")[0]?.trim();
    }

    // Fallback to other common proxy headers
    if (!clientIP) {
      clientIP =
        (req.headers["x-real-ip"] as string) ||
        (req.headers["x-forwarded"] as string) ||
        (req.headers["forwarded-for"] as string) ||
        (req.headers["forwarded"] as string);
    }

    // Ultimate fallback to Express's req.ip
    if (!clientIP) {
      clientIP = req.ip;
    }

    // Clean up the IP address (remove port if present)
    if (clientIP) {
      // Handle IPv6 addresses wrapped in brackets
      clientIP = clientIP.replace(/^\[|\]$/g, "");
      // Remove port number if present (IPv4)
      clientIP = clientIP.split(":")[0];
    }

    // In development mode, use fallback IP for localhost/private IPs
    // This allows testing SideShift API locally
    const isDev =
      process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    if (isDev && isLocalhostOrPrivateIP(clientIP)) {
      logger.debug(
        {
          originalIp: clientIP,
          fallbackIp: DEV_FALLBACK_IP,
        },
        "Using fallback IP for localhost development"
      );
      clientIP = DEV_FALLBACK_IP;
    }

    const finalIP = clientIP || "unknown";

    // Set the extracted IP on the request object (both properties for compatibility)
    req.userIp = finalIP;
    req.clientIp = finalIP;

    logger.debug(
      {
        userIp: req.userIp,
        headers: {
          "x-forwarded-for": req.headers["x-forwarded-for"],
          "x-real-ip": req.headers["x-real-ip"],
        },
        remoteAddress: req.socket.remoteAddress,
        ip: req.ip,
      },
      "Client IP extracted"
    );

    next();
  } catch (error) {
    logger.error({ error }, "Error extracting client IP");
    const fallback =
      process.env.NODE_ENV === "development" ? DEV_FALLBACK_IP : "unknown";
    req.userIp = fallback;
    req.clientIp = fallback;
    next();
  }
}

/**
 * Get the real client IP, accounting for proxy headers
 * Uses fallback IP in development for localhost requests
 */
export function getClientIP(req: Request): string {
  const ip = req.userIp || req.clientIp;

  // In development, provide fallback for localhost
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  if (isDev && isLocalhostOrPrivateIP(ip)) {
    return DEV_FALLBACK_IP;
  }

  return ip || "unknown";
}
