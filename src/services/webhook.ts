import crypto from "crypto";
import { logger } from "../utils/logger";

/**
 * Webhook event types
 */
export enum WebhookEventType {
  SHIFT_CREATED = "shift.created",
  SHIFT_UPDATED = "shift.updated",
  SHIFT_COMPLETED = "shift.completed",
  SHIFT_FAILED = "shift.failed",
  SHIFT_REFUNDED = "shift.refunded",
  ALERT_TRIGGERED = "alert.triggered",
  WATCHLIST_CREATED = "watchlist.created",
  WATCHLIST_UPDATED = "watchlist.updated",
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: any;
  userId?: string;
}

/**
 * Webhook delivery attempt
 */
export interface WebhookAttempt {
  attemptNumber: number;
  timestamp: string;
  statusCode?: number;
  error?: string;
  duration: number;
}

/**
 * Webhook record for tracking
 */
export interface WebhookRecord {
  id: string;
  url: string;
  payload: WebhookPayload;
  attempts: WebhookAttempt[];
  status: "pending" | "delivered" | "failed" | "dead_letter";
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
}

/**
 * In-memory webhook queue (in production, use Redis or database)
 */
const webhookQueue: WebhookRecord[] = [];
const deadLetterQueue: WebhookRecord[] = [];

/**
 * Webhook configuration
 */
const WEBHOOK_CONFIG = {
  maxRetries: 3,
  retryDelays: [1000, 5000, 25000], // 1s, 5s, 25s (exponential backoff)
  timeout: 10000, // 10 seconds
  signatureHeader: "X-Webhook-Signature",
  timestampHeader: "X-Webhook-Timestamp",
};

/**
 * Generate webhook signature using HMAC SHA-256
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string
): string {
  const data = `${timestamp}.${payload}`;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string
): boolean {
  const expectedSignature = generateWebhookSignature(
    payload,
    secret,
    timestamp
  );
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Send webhook with retry logic
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret?: string
): Promise<WebhookRecord> {
  const webhookId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const record: WebhookRecord = {
    id: webhookId,
    url,
    payload,
    attempts: [],
    status: "pending",
    createdAt: timestamp,
  };

  webhookQueue.push(record);

  logger.info(
    {
      webhookId,
      event: payload.event,
      url: maskUrl(url),
    },
    "Webhook queued"
  );

  // Start delivery process (non-blocking)
  deliverWebhook(record, secret).catch((error) => {
    logger.error({ error, webhookId }, "Webhook delivery process failed");
  });

  return record;
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhook(
  record: WebhookRecord,
  secret?: string
): Promise<void> {
  const maxAttempts = WEBHOOK_CONFIG.maxRetries + 1; // Initial attempt + retries

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptNumber = attempt + 1;

    // Wait for retry delay if not first attempt
    if (attempt > 0) {
      const delay = WEBHOOK_CONFIG.retryDelays[attempt - 1];
      await sleep(delay);
    }

    const startTime = Date.now();
    const timestamp = Date.now().toString();
    const payloadString = JSON.stringify(record.payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "OctaneShift-Webhook/1.0",
      [WEBHOOK_CONFIG.timestampHeader]: timestamp,
    };

    // Add signature if secret provided
    if (secret) {
      const signature = generateWebhookSignature(
        payloadString,
        secret,
        timestamp
      );
      headers[WEBHOOK_CONFIG.signatureHeader] = signature;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        WEBHOOK_CONFIG.timeout
      );

      const response = await fetch(record.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      const attemptRecord: WebhookAttempt = {
        attemptNumber,
        timestamp: new Date().toISOString(),
        statusCode: response.status,
        duration,
      };

      record.attempts.push(attemptRecord);
      record.lastAttemptAt = attemptRecord.timestamp;

      // Success - 2xx status codes
      if (response.status >= 200 && response.status < 300) {
        record.status = "delivered";

        logger.info(
          {
            webhookId: record.id,
            event: record.payload.event,
            url: maskUrl(record.url),
            attempts: attemptNumber,
            statusCode: response.status,
            duration,
          },
          "Webhook delivered successfully"
        );

        return;
      }

      // Non-success status
      attemptRecord.error = `HTTP ${response.status}: ${response.statusText}`;

      logger.warn(
        {
          webhookId: record.id,
          event: record.payload.event,
          url: maskUrl(record.url),
          attempt: attemptNumber,
          maxAttempts,
          statusCode: response.status,
          duration,
        },
        "Webhook delivery failed"
      );
    } catch (error: any) {
      const duration = Date.now() - startTime;

      const attemptRecord: WebhookAttempt = {
        attemptNumber,
        timestamp: new Date().toISOString(),
        error: error.message || "Unknown error",
        duration,
      };

      record.attempts.push(attemptRecord);
      record.lastAttemptAt = attemptRecord.timestamp;

      logger.warn(
        {
          webhookId: record.id,
          event: record.payload.event,
          url: maskUrl(record.url),
          attempt: attemptNumber,
          maxAttempts,
          error: error.message,
          duration,
        },
        "Webhook delivery error"
      );
    }

    // If this was the last attempt, move to dead letter queue
    if (attempt === maxAttempts - 1) {
      record.status = "dead_letter";
      deadLetterQueue.push(record);

      logger.error(
        {
          webhookId: record.id,
          event: record.payload.event,
          url: maskUrl(record.url),
          totalAttempts: record.attempts.length,
        },
        "Webhook moved to dead letter queue after max retries"
      );

      return;
    }
  }

  // If we reach here, all retries failed
  record.status = "failed";
}

/**
 * Get webhook record by ID
 */
export function getWebhookRecord(webhookId: string): WebhookRecord | undefined {
  return webhookQueue.find((r) => r.id === webhookId);
}

/**
 * Get all webhook records
 */
export function getAllWebhookRecords(): WebhookRecord[] {
  return [...webhookQueue];
}

/**
 * Get dead letter queue
 */
export function getDeadLetterQueue(): WebhookRecord[] {
  return [...deadLetterQueue];
}

/**
 * Retry webhook from dead letter queue
 */
export async function retryWebhookFromDeadLetter(
  webhookId: string,
  secret?: string
): Promise<boolean> {
  const index = deadLetterQueue.findIndex((r) => r.id === webhookId);

  if (index === -1) {
    return false;
  }

  const record = deadLetterQueue[index];

  // Remove from dead letter queue
  deadLetterQueue.splice(index, 1);

  // Reset record
  record.status = "pending";
  record.attempts = [];
  record.lastAttemptAt = undefined;
  record.nextRetryAt = undefined;

  // Add back to queue
  webhookQueue.push(record);

  logger.info(
    {
      webhookId,
      event: record.payload.event,
    },
    "Webhook requeued from dead letter queue"
  );

  // Start delivery
  await deliverWebhook(record, secret);

  return true;
}

/**
 * Clear old webhook records (cleanup)
 */
export function clearOldWebhookRecords(
  maxAgeMs: number = 24 * 60 * 60 * 1000
): number {
  const cutoffTime = Date.now() - maxAgeMs;
  let removedCount = 0;

  // Clear from webhook queue
  for (let i = webhookQueue.length - 1; i >= 0; i--) {
    const record = webhookQueue[i];
    const recordTime = new Date(record.createdAt).getTime();

    if (
      recordTime < cutoffTime &&
      (record.status === "delivered" || record.status === "failed")
    ) {
      webhookQueue.splice(i, 1);
      removedCount++;
    }
  }

  logger.info({ removedCount, maxAgeMs }, "Cleared old webhook records");

  return removedCount;
}

/**
 * Get webhook statistics
 */
export function getWebhookStats(): {
  total: number;
  pending: number;
  delivered: number;
  failed: number;
  deadLetter: number;
} {
  return {
    total: webhookQueue.length,
    pending: webhookQueue.filter((r) => r.status === "pending").length,
    delivered: webhookQueue.filter((r) => r.status === "delivered").length,
    failed: webhookQueue.filter((r) => r.status === "failed").length,
    deadLetter: deadLetterQueue.length,
  };
}

/**
 * Helper: Mask URL for logging
 */
function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log webhook event
 */
export function logWebhookEvent(
  eventType: WebhookEventType,
  data: any,
  userId?: string
): void {
  logger.info(
    {
      event: "webhook_event",
      eventType,
      userId,
      dataKeys: Object.keys(data),
    },
    "Webhook event logged"
  );
}
