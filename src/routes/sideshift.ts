import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import sideshift, { CreateVariableShiftRequestSchema, SideShiftError } from '../lib/sideshift';
import { checkPermissions } from '../middleware/compliance';
import { APIError, ValidationError } from '../middleware/errors';
import { rateLimitConfig } from '../middleware/rateLimit';
import { pairCache } from '../utils/cache';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas for route parameters
const PairQuerySchema = z.object({
  from: z.string().min(1, 'from parameter is required'),
  to: z.string().min(1, 'to parameter is required'),
  amount: z.string().optional()
});

const ShiftIdSchema = z.object({
  id: z.string().min(1, 'Shift ID is required')
});

/**
 * GET /api/permissions
 * Get user permissions from SideShift
 */
router.get('/permissions', rateLimitConfig.general, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userIp = (req as any).userIp;
    const permissions = await sideshift.getPermissions(userIp);
    
    logger.info({ userIp }, 'Retrieved user permissions');
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    next(error instanceof SideShiftError ? 
      new APIError(error.status, 'SideShift API Error', error.message, error.code) : 
      error
    );
  }
});

/**
 * GET /api/pair?from=COIN-NET&to=COIN-NET&amount=NUM
 * Get trading pair information with caching
 */
router.get('/pair', rateLimitConfig.general, checkPermissions, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryParams = PairQuerySchema.parse(req.query);
    
    // Create cache key
    const cacheKey = `pair:${queryParams.from}:${queryParams.to}:${queryParams.amount || 'no-amount'}`;
    
    // Check cache first
    const cachedResult = pairCache.get(cacheKey);
    if (cachedResult) {
      logger.debug({ cacheKey }, 'Returning cached pair data');
      res.json({
        success: true,
        data: cachedResult,
        cached: true
      });
      return;
    }
    
    // Fetch from SideShift API
    const pair = await sideshift.getPair(queryParams);
    
    // Cache the result
    pairCache.set(cacheKey, pair);
    
    logger.info({ 
      from: queryParams.from, 
      to: queryParams.to,
      amount: queryParams.amount 
    }, 'Retrieved trading pair information');
    
    res.json({
      success: true,
      data: pair,
      cached: false
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid query parameters: ' + error.errors.map(e => e.message).join(', ')));
    } else if (error instanceof SideShiftError) {
      next(new APIError(error.status, 'SideShift API Error', error.message, error.code));
    } else {
      next(error);
    }
  }
});

/**
 * POST /api/shifts/variable
 * Create a variable shift
 */
router.post('/shifts/variable', rateLimitConfig.strict, checkPermissions, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userIp = (req as any).userIp;
    const shiftRequest = CreateVariableShiftRequestSchema.parse(req.body);
    
    const shift = await sideshift.createVariableShift(shiftRequest, userIp);
    
    logger.info({ 
      shiftId: shift.id,
      depositCoin: shift.depositCoin,
      settleCoin: shift.settleCoin,
      userIp
    }, 'Created variable shift');
    
    // Return the essential information for the client
    res.status(201).json({
      success: true,
      data: {
        id: shift.id,
        depositAddress: shift.depositAddress,
        depositMemo: shift.depositMemo,
        depositMin: shift.depositMin,
        depositMax: shift.depositMax,
        expiresAt: shift.expiresAt,
        status: shift.status,
        depositCoin: shift.depositCoin,
        depositNetwork: shift.depositNetwork,
        settleCoin: shift.settleCoin,
        settleNetwork: shift.settleNetwork,
        settleAddress: shift.settleAddress
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid shift request: ' + error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')));
    } else if (error instanceof SideShiftError) {
      next(new APIError(error.status, 'SideShift API Error', error.message, error.code));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/shifts/:id
 * Get shift status and details
 */
router.get('/shifts/:id', rateLimitConfig.general, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = ShiftIdSchema.parse(req.params);
    const userIp = (req as any).userIp;
    
    const shift = await sideshift.getShift(params.id, userIp);
    
    logger.info({ shiftId: params.id, status: shift.status }, 'Retrieved shift details');
    
    res.json({
      success: true,
      data: shift
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid shift ID'));
    } else if (error instanceof SideShiftError) {
      if (error.status === 404) {
        next(new APIError(404, 'Shift Not Found', 'The specified shift was not found'));
      } else {
        next(new APIError(error.status, 'SideShift API Error', error.message, error.code));
      }
    } else {
      next(error);
    }
  }
});

export default router;