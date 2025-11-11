/**
 * Phase I: Notifications API
 * Endpoints for retrieving and managing user notifications
 */

import crypto from "crypto";
import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import * as notificationService from "../services/notifications";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user
 */
router.get("/", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const notifications = notificationService.getUserNotifications(userId);

    res.json({
      success: true,
      data: notifications,
      meta: {
        total: notifications.length,
        unread: notifications.filter((n) => !n.read).length,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get notifications");
    res.status(500).json({
      success: false,
      error: "Failed to retrieve notifications",
    });
  }
});

/**
 * GET /api/notifications/unread
 * Get unread notifications for the authenticated user
 */
router.get("/unread", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const notifications = notificationService.getUnreadNotifications(userId);

    res.json({
      success: true,
      data: notifications,
      meta: {
        count: notifications.length,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get unread notifications");
    res.status(500).json({
      success: false,
      error: "Failed to retrieve unread notifications",
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put("/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const success = notificationService.markAsRead(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    logger.error({ error }, "Failed to mark notification as read");
    return res.status(500).json({
      success: false,
      error: "Failed to mark notification as read",
    });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read for the authenticated user
 */
router.put("/read-all", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const count = notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: `Marked ${count} notifications as read`,
      meta: { count },
    });
  } catch (error) {
    logger.error({ error }, "Failed to mark all notifications as read");
    res.status(500).json({
      success: false,
      error: "Failed to mark all notifications as read",
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const success = notificationService.deleteNotification(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    return res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    logger.error({ error }, "Failed to delete notification");
    return res.status(500).json({
      success: false,
      error: "Failed to delete notification",
    });
  }
});

/**
 * GET /api/notifications/alerts
 * Get all alerts with deep links for the authenticated user
 */
router.get("/alerts", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const alerts = store.getUserAlerts(userId);

    const frontendUrl = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      logger.error("JWT_SECRET not configured");
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
      });
    }

    // Add deep link URLs to alerts
    const alertsWithLinks = alerts.map((alert) => {
      // Generate deep link token
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      const payload = `${alert.id}:${alert.chain}:${alert.address}:${alert.threshold}:${expiresAt}`;

      const hmac = crypto.createHmac("sha256", jwtSecret);
      hmac.update(payload);
      const signature = hmac.digest("hex");

      const tokenData = {
        alertId: alert.id,
        chain: alert.chain,
        address: alert.address,
        settleAmount: alert.threshold,
        expiresAt,
        signature,
      };

      const token = Buffer.from(JSON.stringify(tokenData)).toString("base64");
      const deepLink = `${frontendUrl}/r?token=${token}`;

      return {
        ...alert,
        deepLink,
        expiresAt,
      };
    });

    return res.json({
      success: true,
      data: alertsWithLinks,
      meta: {
        total: alertsWithLinks.length,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get alerts");
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve alerts",
    });
  }
});

export default router;
