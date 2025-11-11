/**
 * Phase I: Refund/Expired Notification Service
 * Sends notifications via bot and stores them for web display
 */

import type { TelegramBotService } from "../bot/telegram";
import { logger } from "../utils/logger";

export interface ShiftNotification {
  id: string;
  userId: string;
  shiftId: string;
  type: "refunded" | "expired" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    refundAddress?: string;
    refundMemo?: string;
    depositAmount?: string;
    depositCoin?: string;
    settleAddress?: string;
    settleCoin?: string;
    supportUrl?: string;
  };
}

// In-memory store for notifications (should be moved to DB in production)
const notifications = new Map<string, ShiftNotification>();
const userNotifications = new Map<string, string[]>(); // userId -> notificationIds[]

// Map user ID to Telegram chat ID
const userTelegramMap = new Map<string, number>(); // userId -> telegramChatId

// Bot service reference (set from index.ts after bot initialization)
let botService: TelegramBotService | null = null;

/**
 * Set the Telegram bot service reference
 */
export function setBotService(service: TelegramBotService | null): void {
  botService = service;
  logger.info(
    { hasBotService: !!botService },
    "Bot service configured for notifications"
  );
}

/**
 * Register a user's Telegram chat ID for notifications
 */
export function registerTelegramUser(userId: string, chatId: number): void {
  userTelegramMap.set(userId, chatId);
  logger.debug(
    { userId, chatId },
    "Telegram user registered for notifications"
  );
}

/**
 * Send a message via Telegram bot if available
 */
async function sendTelegramNotification(
  userId: string,
  message: string
): Promise<boolean> {
  if (!botService) {
    logger.debug("Bot service not available - skipping telegram notification");
    return false;
  }

  const chatId = userTelegramMap.get(userId);
  if (!chatId) {
    logger.debug({ userId }, "No telegram chat ID found for user");
    return false;
  }

  try {
    await botService.sendNotification(chatId, message, {
      parse_mode: "Markdown",
    });
    return true;
  } catch (error) {
    logger.error(
      { error, userId, chatId },
      "Failed to send telegram notification"
    );
    return false;
  }
}

/**
 * Create a notification for a user
 */
export function createNotification(
  userId: string,
  shiftId: string,
  type: "refunded" | "expired" | "warning" | "info",
  title: string,
  message: string,
  metadata?: ShiftNotification["metadata"]
): ShiftNotification {
  const notification: ShiftNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    userId,
    shiftId,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    metadata,
  };

  notifications.set(notification.id, notification);

  // Add to user's notification list
  const userNotifs = userNotifications.get(userId) || [];
  userNotifs.unshift(notification.id); // Add to front
  userNotifications.set(userId, userNotifs);

  logger.info(
    {
      notificationId: notification.id,
      userId,
      shiftId,
      type,
    },
    "Notification created"
  );

  return notification;
}

/**
 * Get all notifications for a user
 */
export function getUserNotifications(userId: string): ShiftNotification[] {
  const notifIds = userNotifications.get(userId) || [];
  return notifIds
    .map((id) => notifications.get(id))
    .filter((n): n is ShiftNotification => n !== undefined);
}

/**
 * Get unread notifications for a user
 */
export function getUnreadNotifications(userId: string): ShiftNotification[] {
  return getUserNotifications(userId).filter((n) => !n.read);
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId: string): boolean {
  const notification = notifications.get(notificationId);
  if (!notification) return false;

  notification.read = true;
  notifications.set(notificationId, notification);

  logger.debug({ notificationId }, "Notification marked as read");
  return true;
}

/**
 * Mark all user notifications as read
 */
export function markAllAsRead(userId: string): number {
  const userNotifs = getUserNotifications(userId);
  let count = 0;

  for (const notif of userNotifs) {
    if (!notif.read) {
      notif.read = true;
      notifications.set(notif.id, notif);
      count++;
    }
  }

  logger.info({ userId, count }, "Marked all notifications as read");
  return count;
}

/**
 * Delete a notification
 */
export function deleteNotification(notificationId: string): boolean {
  const notification = notifications.get(notificationId);
  if (!notification) return false;

  notifications.delete(notificationId);

  // Remove from user's list
  const userNotifs = userNotifications.get(notification.userId) || [];
  const index = userNotifs.indexOf(notificationId);
  if (index > -1) {
    userNotifs.splice(index, 1);
    userNotifications.set(notification.userId, userNotifs);
  }

  logger.info({ notificationId }, "Notification deleted");
  return true;
}

/**
 * Handle shift refunded event
 */
export function notifyShiftRefunded(
  userId: string,
  shiftId: string,
  refundAddress: string,
  refundMemo: string | undefined,
  depositAmount: string,
  depositCoin: string
): ShiftNotification {
  const title = "💸 Shift Refunded";
  let message = `Your deposit of ${depositAmount} ${depositCoin.toUpperCase()} has been refunded.\n\n`;
  message += `Refund Address: ${refundAddress}\n`;
  if (refundMemo) {
    message += `Refund Memo: ${refundMemo}\n`;
  }
  message += `\nThe refund should arrive shortly. If you don't receive it within 24 hours, please contact SideShift support.`;

  const notification = createNotification(
    userId,
    shiftId,
    "refunded",
    title,
    message,
    {
      refundAddress,
      refundMemo,
      depositAmount,
      depositCoin,
      supportUrl: "https://sideshift.ai/support",
    }
  );

  // Send telegram notification asynchronously
  sendTelegramNotification(userId, `${title}\n\n${message}`).catch((error) => {
    logger.error(
      { error, userId, shiftId },
      "Failed to send telegram refund notification"
    );
  });

  return notification;
}

/**
 * Handle shift expired event
 */
export function notifyShiftExpired(
  userId: string,
  shiftId: string,
  settleAddress: string,
  settleCoin: string
): ShiftNotification {
  const title = "⏰ Shift Expired";
  let message = `Your shift has expired before receiving a deposit.\n\n`;
  message += `Shift ID: ${shiftId}\n`;
  message += `Settle Address: ${settleAddress}\n`;
  message += `Settle Coin: ${settleCoin.toUpperCase()}\n\n`;
  message += `No funds were deposited, so no action is needed. You can create a new shift if you'd like to try again.`;

  const notification = createNotification(
    userId,
    shiftId,
    "expired",
    title,
    message,
    {
      settleAddress,
      settleCoin,
    }
  );

  // Send telegram notification asynchronously
  sendTelegramNotification(userId, `${title}\n\n${message}`).catch((error) => {
    logger.error(
      { error, userId, shiftId },
      "Failed to send telegram expired notification"
    );
  });

  return notification;
}

/**
 * Handle wrong amount deposited
 */
export function notifyWrongAmount(
  userId: string,
  shiftId: string,
  depositAmount: string,
  depositCoin: string,
  minAmount: string,
  maxAmount: string
): ShiftNotification {
  const title = "⚠️ Wrong Amount Deposited";
  let message = `The amount you deposited (${depositAmount} ${depositCoin.toUpperCase()}) is outside the allowed range.\n\n`;
  message += `Required: ${minAmount} - ${maxAmount} ${depositCoin.toUpperCase()}\n\n`;
  message += `Your deposit will be refunded to your refund address if provided. `;
  message += `If you didn't set a refund address, please contact SideShift support immediately.`;

  return createNotification(userId, shiftId, "warning", title, message, {
    depositAmount,
    depositCoin,
    supportUrl: "https://sideshift.ai/support",
  });
}

/**
 * Cleanup old notifications (older than 30 days)
 */
export function cleanupOldNotifications(): number {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let count = 0;

  for (const [id, notification] of notifications.entries()) {
    const notifTime = new Date(notification.timestamp).getTime();
    if (notifTime < thirtyDaysAgo) {
      deleteNotification(id);
      count++;
    }
  }

  if (count > 0) {
    logger.info({ count }, "Cleaned up old notifications");
  }

  return count;
}

// Run cleanup every 24 hours
setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000);
