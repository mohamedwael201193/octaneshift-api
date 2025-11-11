/**
 * Idempotency and retry logic for SideShift operations
 */

import crypto from "crypto";
import logger from "../utils/logger";

interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number;
  backoffMultiplier: number;
}

interface RequestTracker {
  timestamp: number;
  count: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

// Per-user request tracking for rate limiting
const userRequestTrackers = new Map<
  string,
  {
    quotes: RequestTracker[];
    shifts: RequestTracker[];
  }
>();

// Cleanup old tracking data every 5 minutes
setInterval(() => {
  const now = Date.now();
  const fifteenMinutesAgo = now - 15 * 60 * 1000;

  for (const [userId, tracker] of userRequestTrackers.entries()) {
    tracker.quotes = tracker.quotes.filter(
      (r) => r.timestamp > fifteenMinutesAgo
    );
    tracker.shifts = tracker.shifts.filter(
      (r) => r.timestamp > fifteenMinutesAgo
    );

    // Remove user if no recent activity
    if (tracker.quotes.length === 0 && tracker.shifts.length === 0) {
      userRequestTrackers.delete(userId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate a unique external ID for idempotency
 */
export function generateExternalId(
  userId: string,
  address: string,
  timestamp: number = Date.now(),
  random: string = crypto.randomBytes(8).toString("hex")
): string {
  const data = `${userId}|${address}|${timestamp}|${random}`;
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .substring(0, 32);
}

/**
 * Check if user has exceeded quote rate limit (20/min)
 */
export function checkQuoteRateLimit(userId: string): {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
} {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  let tracker = userRequestTrackers.get(userId);
  if (!tracker) {
    tracker = { quotes: [], shifts: [] };
    userRequestTrackers.set(userId, tracker);
  }

  // Filter out requests older than 1 minute
  tracker.quotes = tracker.quotes.filter((r) => r.timestamp > oneMinuteAgo);

  const QUOTE_LIMIT = 20;
  const currentCount = tracker.quotes.length;

  if (currentCount >= QUOTE_LIMIT) {
    const oldestRequest = tracker.quotes[0];
    const resetTime = oldestRequest.timestamp + 60 * 1000;

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime,
    };
  }

  // Add current request
  tracker.quotes.push({ timestamp: now, count: currentCount + 1 });

  return {
    allowed: true,
    remainingRequests: QUOTE_LIMIT - (currentCount + 1),
    resetTime: now + 60 * 1000,
  };
}

/**
 * Check if user has exceeded shift rate limit (5/min)
 */
export function checkShiftRateLimit(userId: string): {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
} {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  let tracker = userRequestTrackers.get(userId);
  if (!tracker) {
    tracker = { quotes: [], shifts: [] };
    userRequestTrackers.set(userId, tracker);
  }

  // Filter out requests older than 1 minute
  tracker.shifts = tracker.shifts.filter((r) => r.timestamp > oneMinuteAgo);

  const SHIFT_LIMIT = 5;
  const currentCount = tracker.shifts.length;

  if (currentCount >= SHIFT_LIMIT) {
    const oldestRequest = tracker.shifts[0];
    const resetTime = oldestRequest.timestamp + 60 * 1000;

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime,
    };
  }

  // Add current request
  tracker.shifts.push({ timestamp: now, count: currentCount + 1 });

  return {
    allowed: true,
    remainingRequests: SHIFT_LIMIT - (currentCount + 1),
    resetTime: now + 60 * 1000,
  };
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attemptNumber: number,
  config: RetryConfig
): number {
  const delay =
    config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: string = "operation"
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retryConfig.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain status codes
      if (error.status && error.status < 500 && error.status !== 429) {
        logger.warn(
          { error, attempt, context },
          "Non-retryable error encountered"
        );
        throw error;
      }

      // Check if we should retry
      if (attempt <= retryConfig.maxRetries) {
        const delay = calculateBackoffDelay(attempt, retryConfig);
        logger.warn(
          {
            error,
            attempt,
            delay,
            context,
            maxRetries: retryConfig.maxRetries,
          },
          "Retrying after error"
        );
        await sleep(delay);
      }
    }
  }

  logger.error(
    { lastError, context, maxRetries: retryConfig.maxRetries },
    "All retry attempts failed"
  );
  throw lastError;
}

/**
 * Enforce sequential execution with delay between operations
 */
let lastOperationTime = 0;
const OPERATION_DELAY = 800; // 750-1000ms range, using 800ms

export async function enforceSequentialDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastOp = now - lastOperationTime;

  if (timeSinceLastOp < OPERATION_DELAY) {
    const waitTime = OPERATION_DELAY - timeSinceLastOp;
    logger.debug({ waitTime }, "Enforcing sequential delay");
    await sleep(waitTime);
  }

  lastOperationTime = Date.now();
}

/**
 * Get rate limit stats for a user
 */
export function getUserRateLimitStats(userId: string): {
  quotes: { count: number; limit: number; windowMs: number };
  shifts: { count: number; limit: number; windowMs: number };
} {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  const tracker = userRequestTrackers.get(userId);

  if (!tracker) {
    return {
      quotes: { count: 0, limit: 20, windowMs: 60000 },
      shifts: { count: 0, limit: 5, windowMs: 60000 },
    };
  }

  const recentQuotes = tracker.quotes.filter((r) => r.timestamp > oneMinuteAgo);
  const recentShifts = tracker.shifts.filter((r) => r.timestamp > oneMinuteAgo);

  return {
    quotes: { count: recentQuotes.length, limit: 20, windowMs: 60000 },
    shifts: { count: recentShifts.length, limit: 5, windowMs: 60000 },
  };
}
