import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { getClientIP } from './ip';

/**
 * Rate limiting configuration for different endpoints
 */
export const rateLimitConfig = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      type: 'about:blank#rate-limit',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many requests from this IP, please try again later.',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return getClientIP(req);
    },
    handler: (req, res) => {
      const ip = getClientIP(req);
      logger.warn({ 
        userIp: ip,
        url: req.originalUrl,
        method: req.method 
      }, 'Rate limit exceeded');
      
      res.status(429);
      res.setHeader('Content-Type', 'application/problem+json');
      res.json({
        type: 'about:blank#rate-limit',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many requests from this IP, please try again later.',
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || `req_${Date.now()}`
      });
    }
  }),

  // Strict rate limit for sensitive endpoints
  strict: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
      type: 'about:blank#rate-limit-strict',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many requests to this endpoint, please try again later.',
      timestamp: new Date().toISOString()
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return getClientIP(req);
    },
    handler: (req, res) => {
      const ip = getClientIP(req);
      logger.warn({ 
        userIp: ip,
        url: req.originalUrl,
        method: req.method 
      }, 'Strict rate limit exceeded');
      
      res.status(429);
      res.setHeader('Content-Type', 'application/problem+json');
      res.json({
        type: 'about:blank#rate-limit-strict',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Too many requests to this endpoint, please try again later.',
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || `req_${Date.now()}`
      });
    }
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
      const userAgent = req.headers['user-agent']?.toLowerCase() || '';
      return userAgent.includes('pingdom') || 
             userAgent.includes('uptimerobot') || 
             userAgent.includes('statuspage');
    }
  })
};

export default rateLimitConfig;