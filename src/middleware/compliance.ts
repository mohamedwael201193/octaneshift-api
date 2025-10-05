import { NextFunction, Request, Response } from 'express';
import sideshift, { SideShiftError } from '../lib/sideshift';
import { logger } from '../utils/logger';
import { APIError } from './errors';

export interface PermissionCheckResult {
  createShift: boolean;
  affiliate?: boolean;
  requestQuote?: boolean;
  country?: string;
  restricted?: boolean;
}

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
    const userIp = (req as any).userIp || 'unknown';
    
    // Skip permission check in demo mode for non-mutating operations
    const isDemoMode = process.env.DEMO_MODE === 'true';
    const isReadOnlyOperation = req.method === 'GET' && req.path.includes('/pair');
    
    if (isDemoMode && isReadOnlyOperation) {
      logger.debug({ userIp: maskIp(userIp) }, 'Skipping permission check in demo mode');
      next();
      return;
    }

    logger.debug({ userIp: maskIp(userIp) }, 'Checking user permissions');

    // Call SideShift to check permissions
    const permissions = await sideshift.getPermissions(userIp);
    
    // Check if user is restricted (no createShift permission typically means restricted)
    if (!permissions.createShift) {
      logger.warn({ 
        userIp: maskIp(userIp),
        permissions,
        path: req.path,
        method: req.method
      }, 'User access restricted by region');

      // Return 451 Unavailable For Legal Reasons
      res.status(451);
      res.setHeader('Content-Type', 'application/problem+json');
      res.json({
        type: 'about:blank#region-restricted',
        title: 'Unavailable For Legal Reasons',
        status: 451,
        detail: 'Not available in your region.',
        instance: req.originalUrl,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
        restricted: true,
        country: (permissions as any).country || 'unknown',
        message: 'Not available in your region.'
      });
      return;
    }

    // Store permissions in request for potential later use
    (req as any).userPermissions = permissions;
    
    logger.debug({ 
      userIp: maskIp(userIp),
      hasCreateShift: permissions.createShift,
      hasAffiliate: permissions.affiliate
    }, 'User permissions verified');

    next();
  } catch (error) {
    if (error instanceof SideShiftError) {
      // If SideShift API is down or returns an error, we'll allow the request to proceed
      // but log the issue for monitoring
      logger.warn({
        error: {
          status: error.status,
          message: error.message,
          code: error.code
        },
        userIp: maskIp((req as any).userIp || 'unknown'),
        path: req.path
      }, 'Permission check failed, allowing request to proceed');
      
      next();
    } else {
      logger.error({
        error,
        userIp: maskIp((req as any).userIp || 'unknown'),
        path: req.path
      }, 'Unexpected error in permission check');
      
      next(new APIError(500, 'Permission Check Failed', 'Unable to verify user permissions'));
    }
  }
}

/**
 * Mask IP address for logging (hide last octet for IPv4)
 */
function maskIp(ip: string): string {
  if (!ip || ip === 'unknown') return ip;
  
  // Handle IPv4 addresses
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }
  
  // Handle IPv6 addresses (mask last 4 characters)
  if (ip.includes(':')) {
    if (ip.length > 4) {
      return ip.slice(0, -4) + '****';
    }
  }
  
  // Fallback: mask last 4 characters
  if (ip.length > 4) {
    return ip.slice(0, -4) + '****';
  }
  
  return '****';
}

/**
 * Mask wallet address for logging (hide last 6 characters)
 */
export function maskWalletAddress(address: string): string {
  if (!address || address.length <= 6) {
    return '******';
  }
  
  return address.slice(0, -6) + '******';
}

export { maskIp };
