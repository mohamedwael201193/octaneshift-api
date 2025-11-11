import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth";
import { rateLimitConfig } from "../middleware/rateLimit";
import { logger } from "../utils/logger";

const router = Router();

/**
 * Schema for checkout request
 */
const CheckoutRequestSchema = z.object({
  settleCoin: z.string(),
  settleNetwork: z.string(),
  settleAmount: z.string(),
  settleAddress: z.string(),
  settleMemo: z.string().optional(),
  refundAddress: z.string().optional(),
  refundMemo: z.string().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/**
 * POST /api/checkout
 * Create a hosted checkout session with SideShift
 *
 * This provides a fallback option for users who prefer SideShift's
 * hosted checkout flow instead of the embedded experience.
 */
router.post(
  "/",
  authenticateToken,
  rateLimitConfig.shiftCreation,
  async (req, res) => {
    try {
      const userId = (req as any).userId;

      // Validate request
      const validationResult = CheckoutRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
      }

      const {
        settleCoin,
        settleNetwork,
        settleAmount,
        settleAddress,
        settleMemo,
        refundAddress,
        refundMemo,
        successUrl,
        cancelUrl,
      } = validationResult.data;

      logger.info(
        {
          userId,
          settleCoin,
          settleNetwork,
          settleAmount,
        },
        "Creating hosted checkout session"
      );

      // Build checkout request for SideShift
      const checkoutData: any = {
        settleCoin,
        settleNetwork,
        settleAmount,
        settleAddress,
      };

      if (settleMemo) checkoutData.settleMemo = settleMemo;
      if (refundAddress) checkoutData.refundAddress = refundAddress;
      if (refundMemo) checkoutData.refundMemo = refundMemo;

      // Add success/cancel URLs if provided
      if (successUrl) checkoutData.successUrl = successUrl;
      if (cancelUrl) checkoutData.cancelUrl = cancelUrl;

      // Call SideShift checkout API
      // Note: This endpoint might not exist in SideShift v2 API
      // If not available, we can construct a URL to SideShift's hosted page
      // with query parameters instead

      // Fallback: Construct hosted checkout URL
      const baseUrl = "https://sideshift.ai";
      const params = new URLSearchParams({
        settleCoin,
        settleNetwork,
        settleAmount,
        settleAddress,
        ...(settleMemo && { settleMemo }),
        ...(refundAddress && { refundAddress }),
        ...(refundMemo && { refundMemo }),
        ...(successUrl && { returnUrl: successUrl }),
        ...(process.env.AFFILIATE_ID && {
          affiliateId: process.env.AFFILIATE_ID,
        }),
      });

      const checkoutUrl = `${baseUrl}?${params.toString()}`;

      logger.info(
        {
          userId,
          checkoutUrl: checkoutUrl.substring(0, 100) + "...",
        },
        "Hosted checkout URL created"
      );

      return res.json({
        success: true,
        checkoutUrl,
        message: "Redirect user to this URL for hosted checkout",
      });
    } catch (error: any) {
      logger.error(
        { error, userId: (req as any).userId },
        "Failed to create checkout session"
      );

      if (error.status && error.status < 500) {
        return res.status(error.status).json({
          error: error.message || "Failed to create checkout",
          code: error.code,
        });
      } else {
        return res.status(500).json({
          error: "Internal server error",
        });
      }
    }
  }
);

export default router;
