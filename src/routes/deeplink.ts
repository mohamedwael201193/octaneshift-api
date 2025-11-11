import crypto from "crypto";
import { Router } from "express";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/deeplink/validate
 * Verify HMAC signature and return alert data for frontend prefill
 */
router.get("/validate", async (req, res) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      res.status(400).json({
        success: false,
        error: "Missing token parameter",
      });
      return;
    }

    // Decode the token (format: base64 encoded JSON)
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const data = JSON.parse(decoded);

    const { alertId, chain, address, settleAmount, expiresAt, signature } =
      data;

    // Check expiration
    if (Date.now() > expiresAt) {
      res.status(410).json({
        success: false,
        error: "Deep link has expired",
        expired: true,
      });
      return;
    }

    // Verify HMAC signature
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error("JWT_SECRET not configured for deep link validation");
      res.status(500).json({
        success: false,
        error: "Server configuration error",
      });
      return;
    }

    // Recreate signature
    const payload = `${alertId}:${chain}:${address}:${settleAmount}:${expiresAt}`;
    const hmac = crypto.createHmac("sha256", jwtSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    if (signature !== expectedSignature) {
      res.status(403).json({
        success: false,
        error: "Invalid signature",
      });
      return;
    }

    // Get alert from store
    const alert = store.getAlertById(alertId);

    if (!alert) {
      res.status(404).json({
        success: false,
        error: "Alert not found or has been deleted",
      });
      return;
    }

    // Return validated data for frontend
    res.json({
      success: true,
      data: {
        alertId,
        chain,
        address,
        settleAmount,
        expiresAt,
        alert: {
          type: alert.type,
          currentBalance: alert.balance,
          threshold: alert.threshold,
          message: alert.message,
        },
        simulation: process.env.NODE_ENV === "development",
      },
    });
  } catch (error) {
    logger.error({ error }, "Error validating deep link");
    res.status(500).json({
      success: false,
      error: "Failed to validate deep link",
    });
  }
});

export default router;
