/**
 * Phase I: Notifications API
 * Endpoints for retrieving and managing user notifications
 */

import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import * as notificationService from "../services/notifications";
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

export default router;
