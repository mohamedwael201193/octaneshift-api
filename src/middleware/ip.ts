import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      userIp?: string;
    }
  }
}

/**
 * Extract client IP address from various headers and connection info
 * Prioritizes x-forwarded-for header (for proxy setups like Render)
 * Falls back to req.ip as last resort
 */
export function extractClientIP(req: Request, _res: Response, next: NextFunction): void {
  try {
    let clientIP: string | undefined;

    // Check x-forwarded-for header (most common in proxy environments)
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      // x-forwarded-for can be a comma-separated list of IPs
      // The first IP is the original client IP
      const ips = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      clientIP = ips.split(',')[0]?.trim();
    }

    // Fallback to other common proxy headers
    if (!clientIP) {
      clientIP = req.headers['x-real-ip'] as string ||
                 req.headers['x-forwarded'] as string ||
                 req.headers['forwarded-for'] as string ||
                 req.headers['forwarded'] as string;
    }

    // Ultimate fallback to Express's req.ip
    if (!clientIP) {
      clientIP = req.ip;
    }

    // Clean up the IP address (remove port if present)
    if (clientIP) {
      // Handle IPv6 addresses wrapped in brackets
      clientIP = clientIP.replace(/^\[|\]$/g, '');
      // Remove port number if present (IPv4)
      clientIP = clientIP.split(':')[0];
    }

    // Set the extracted IP on the request object
    req.userIp = clientIP || 'unknown';

    logger.debug({
      userIp: req.userIp,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
      },
      remoteAddress: req.socket.remoteAddress,
      ip: req.ip
    }, 'Client IP extracted');

    next();
  } catch (error) {
    logger.error({ error }, 'Error extracting client IP');
    req.userIp = 'unknown';
    next();
  }
}

/**
 * Get the real client IP, accounting for proxy headers
 */
export function getClientIP(req: Request): string {
  return req.userIp || 'unknown';
}