import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const CreateGiftSchema = z.object({
  chain: z.string(),
  settleAmount: z.string(),
  settleAddress: z.string(),
  message: z.string().optional(),
  ttl: z.number().optional(), // Time-to-live in hours
});

// ============================================
// GIFT ENDPOINTS
// ============================================

/**
 * POST /api/gifts
 * Create a shareable gas gift link
 * Note: Authentication is optional for public access
 */
router.post("/", async (req: any, res) => {
  try {
    // Support both authenticated and anonymous users
    const userId = req.user?.id || `anon_${Date.now()}`;

    // Validate request
    const validationResult = CreateGiftSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validationResult.error.errors,
      });
    }

    const { chain, settleAmount, settleAddress, message, ttl } =
      validationResult.data;

    // Generate gift ID
    const giftId = `gift_${Date.now()}_${crypto
      .randomBytes(4)
      .toString("hex")}`;

    // Calculate expiration (default 30 days)
    const expiresAt = ttl
      ? Date.now() + ttl * 60 * 60 * 1000
      : Date.now() + 30 * 24 * 60 * 60 * 1000;

    store.createGift({
      id: giftId,
      chain,
      settleAmount,
      settleAddress,
      message,
      createdBy: userId,
      expiresAt,
    });

    const frontendUrl = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
    const shareableUrl = `${frontendUrl}/gift/${giftId}`;

    logger.info({ giftId, userId, chain }, "Gift link created");

    return res.json({
      success: true,
      data: {
        giftId,
        shareableUrl,
        gift: {
          chain,
          settleAmount,
          message,
          expiresAt: new Date(expiresAt).toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to create gift link");
    return res.status(500).json({
      success: false,
      error: "Failed to create gift link",
    });
  }
});

/**
 * GET /api/gifts/:id
 * Get gift details
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gift = store.getGift(id);

    if (!gift) {
      return res.status(404).json({
        success: false,
        error: "Gift not found",
      });
    }

    // Check expiration
    if (gift.expiresAt && Date.now() > gift.expiresAt) {
      store.deleteGift(id);
      return res.status(410).json({
        success: false,
        error: "Gift link has expired",
        expired: true,
      });
    }

    return res.json({
      success: true,
      data: {
        chain: gift.chain,
        settleAmount: gift.settleAmount,
        settleAddress: gift.settleAddress,
        message: gift.message,
        createdAt: gift.createdAt,
        expiresAt: gift.expiresAt
          ? new Date(gift.expiresAt).toISOString()
          : undefined,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get gift details");
    return res.status(500).json({
      success: false,
      error: "Failed to get gift details",
    });
  }
});

/**
 * DELETE /api/gifts/:id
 * Delete a gift (creator only)
 */
router.delete("/:id", authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const gift = store.getGift(id);

    if (!gift) {
      return res.status(404).json({
        success: false,
        error: "Gift not found",
      });
    }

    if (gift.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this gift",
      });
    }

    store.deleteGift(id);

    return res.json({
      success: true,
      message: "Gift deleted successfully",
    });
  } catch (error) {
    logger.error({ error }, "Failed to delete gift");
    return res.status(500).json({
      success: false,
      error: "Failed to delete gift",
    });
  }
});

export default router;
