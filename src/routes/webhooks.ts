import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { rateLimitConfig } from "../middleware/rateLimit";
import * as webhookService from "../services/webhook";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/webhooks/stats
 * Get webhook statistics
 */
router.get(
  "/stats",
  authenticateToken,
  rateLimitConfig.general,
  async (_req, res) => {
    try {
      const stats = webhookService.getWebhookStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error({ error }, "Error fetching webhook stats");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * GET /api/webhooks
 * Get all webhook records
 */
router.get(
  "/",
  authenticateToken,
  rateLimitConfig.general,
  async (_req, res) => {
    try {
      const records = webhookService.getAllWebhookRecords();

      res.json({
        success: true,
        webhooks: records,
        count: records.length,
      });
    } catch (error) {
      logger.error({ error }, "Error fetching webhooks");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * GET /api/webhooks/:id
 * Get specific webhook record
 */
router.get(
  "/:id",
  authenticateToken,
  rateLimitConfig.general,
  async (req, res) => {
    try {
      const webhookId = req.params.id;
      const record = webhookService.getWebhookRecord(webhookId);

      if (!record) {
        res.status(404).json({
          error: "Webhook not found",
        });
        return;
      }

      res.json({
        success: true,
        webhook: record,
      });
    } catch (error) {
      logger.error(
        { error, webhookId: req.params.id },
        "Error fetching webhook"
      );
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * GET /api/webhooks/dead-letter/queue
 * Get dead letter queue
 */
router.get(
  "/dead-letter/queue",
  authenticateToken,
  rateLimitConfig.general,
  async (_req, res) => {
    try {
      const deadLetterQueue = webhookService.getDeadLetterQueue();

      res.json({
        success: true,
        deadLetters: deadLetterQueue,
        count: deadLetterQueue.length,
      });
    } catch (error) {
      logger.error({ error }, "Error fetching dead letter queue");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * POST /api/webhooks/dead-letter/:id/retry
 * Retry webhook from dead letter queue
 */
router.post(
  "/dead-letter/:id/retry",
  authenticateToken,
  rateLimitConfig.strict,
  async (req, res) => {
    try {
      const webhookId = req.params.id;
      const secret = process.env.WEBHOOK_SECRET;

      const success = await webhookService.retryWebhookFromDeadLetter(
        webhookId,
        secret
      );

      if (!success) {
        res.status(404).json({
          error: "Webhook not found in dead letter queue",
        });
        return;
      }

      logger.info(
        {
          webhookId,
          userId: (req as any).userId,
        },
        "Webhook retry initiated from dead letter queue"
      );

      res.json({
        success: true,
        message: "Webhook retry initiated",
        webhookId,
      });
    } catch (error) {
      logger.error(
        { error, webhookId: req.params.id },
        "Error retrying webhook"
      );
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * POST /api/webhooks/test
 * Send test webhook
 */
router.post(
  "/test",
  authenticateToken,
  rateLimitConfig.strict,
  async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        res.status(400).json({
          error: "URL is required",
        });
        return;
      }

      const payload: webhookService.WebhookPayload = {
        event: webhookService.WebhookEventType.SHIFT_CREATED,
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          message: "This is a test webhook",
        },
        userId: (req as any).userId,
      };

      const secret = process.env.WEBHOOK_SECRET;
      const record = await webhookService.sendWebhook(url, payload, secret);

      logger.info(
        {
          webhookId: record.id,
          url,
          userId: (req as any).userId,
        },
        "Test webhook sent"
      );

      res.json({
        success: true,
        message: "Test webhook queued",
        webhookId: record.id,
      });
    } catch (error) {
      logger.error({ error }, "Error sending test webhook");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

/**
 * DELETE /api/webhooks/cleanup
 * Cleanup old webhook records
 */
router.delete(
  "/cleanup",
  authenticateToken,
  rateLimitConfig.strict,
  async (req, res) => {
    try {
      const maxAgeHours = parseInt(req.query.maxAgeHours as string) || 24;
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      const removedCount = webhookService.clearOldWebhookRecords(maxAgeMs);

      logger.info(
        {
          removedCount,
          maxAgeHours,
          userId: (req as any).userId,
        },
        "Webhook cleanup completed"
      );

      res.json({
        success: true,
        message: "Webhook cleanup completed",
        removedCount,
        maxAgeHours,
      });
    } catch (error) {
      logger.error({ error }, "Error cleaning up webhooks");
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
);

export default router;
