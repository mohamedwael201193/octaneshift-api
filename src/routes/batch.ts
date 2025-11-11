import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import sideshift from "../lib/sideshift";
import { extractClientIP } from "../middleware/ip";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

// ============================================
// SCHEMAS
// ============================================

const BatchItemSchema = z.object({
  chain: z.string(),
  settleAmount: z.string(),
  settleAddress: z.string(),
  refundAddress: z.string().optional(),
  memo: z.string().optional(),
});

const BatchTopUpSchema = z.object({
  payoutId: z.string().optional(),
  items: z.array(BatchItemSchema).min(1).max(50),
});

// ============================================
// BATCH TOP-UP ENDPOINTS
// ============================================

/**
 * POST /api/topup/batch
 * Create multiple gas top-ups in one request
 * Note: Authentication is optional for public access
 */
router.post("/batch", extractClientIP, async (req: any, res) => {
  try {
    // Support both authenticated and anonymous users
    const userId = req.user?.id || `anon_${Date.now()}`;
    const userIp = req.clientIP;

    // Validate request
    const validationResult = BatchTopUpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validationResult.error.errors,
      });
    }

    const { payoutId: providedPayoutId, items } = validationResult.data;
    const payoutId =
      providedPayoutId ||
      `batch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    logger.info(
      {
        userId,
        payoutId,
        itemCount: items.length,
      },
      "Processing batch top-up"
    );

    const results: any[] = [];

    // Process each item sequentially to respect rate limits
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Get network configuration
        const networks = [
          {
            id: "eth",
            name: "Ethereum",
            nativeCurrency: "ETH",
            settleCoin: "eth-ethereum",
          },
          {
            id: "base",
            name: "Base",
            nativeCurrency: "ETH",
            settleCoin: "eth-base",
          },
          {
            id: "arb",
            name: "Arbitrum",
            nativeCurrency: "ETH",
            settleCoin: "eth-arbitrum",
          },
          {
            id: "op",
            name: "Optimism",
            nativeCurrency: "ETH",
            settleCoin: "eth-optimism",
          },
          {
            id: "pol",
            name: "Polygon",
            nativeCurrency: "POL",
            settleCoin: "pol-polygon",
          },
          {
            id: "avax",
            name: "Avalanche",
            nativeCurrency: "AVAX",
            settleCoin: "avax-avalanche",
          },
        ];

        const network = networks.find((n) => n.id === item.chain);

        if (!network) {
          results.push({
            index: i,
            status: "failed",
            error: `Unsupported chain: ${item.chain}`,
            address: item.settleAddress,
          });
          continue;
        }

        // Try to get fixed quote first
        let shift;
        let isVariable = false;

        try {
          const [settleCoin, settleNetwork] = network.settleCoin.split("-");

          // Request fixed quote
          const quote = await sideshift.requestFixedQuote({
            depositCoin: "usdc",
            depositNetwork: "ethereum",
            settleCoin,
            settleNetwork,
            settleAmount: item.settleAmount,
            affiliateId: process.env.SIDESHIFT_AFFILIATE_ID,
          });

          // Create fixed shift
          shift = await sideshift.createFixedShift(
            {
              quoteId: quote.id,
              settleAddress: item.settleAddress,
              refundAddress: item.refundAddress,
              settleMemo: item.memo,
              affiliateId: process.env.SIDESHIFT_AFFILIATE_ID,
            },
            userIp
          );
        } catch (fixedError) {
          // Fallback to variable shift
          logger.warn(
            { error: fixedError, chain: item.chain },
            "Fixed quote failed, falling back to variable"
          );

          isVariable = true;

          const [settleCoin, settleNetwork] = network.settleCoin.split("-");

          shift = await sideshift.createVariableShift(
            {
              depositCoin: "usdc",
              depositNetwork: "ethereum",
              settleCoin,
              settleNetwork,
              settleAddress: item.settleAddress,
              refundAddress: item.refundAddress,
              settleMemo: item.memo,
              affiliateId: process.env.SIDESHIFT_AFFILIATE_ID,
            },
            userIp
          );
        }

        // Store shift job
        store.createShiftJob({
          userId,
          shiftId: shift.id,
          payoutId,
          status: shift.status,
          depositCoin: shift.depositCoin,
          depositNetwork: shift.depositNetwork,
          settleCoin: shift.settleCoin,
          settleNetwork: shift.settleNetwork,
          settleAddress: shift.settleAddress,
          depositAddress: shift.depositAddress,
          depositAmount: shift.depositMin || "0",
          settleAmount: item.settleAmount,
          expiresAt: shift.expiresAt,
        });

        results.push({
          index: i,
          status: "created",
          shiftId: shift.id,
          type: isVariable ? "variable" : "fixed",
          depositAddress: shift.depositAddress,
          depositAmount: shift.depositAmount || shift.depositMin,
          settleAmount: item.settleAmount,
          rate: shift.rate,
          address: item.settleAddress,
        });

        // Small delay to respect rate limits
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        logger.error({ error, item }, "Failed to create shift for batch item");

        results.push({
          index: i,
          status: "failed",
          error: error.message || "Failed to create shift",
          address: item.settleAddress,
        });
      }
    }

    const successCount = results.filter((r) => r.status === "created").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return res.json({
      success: true,
      data: {
        payoutId,
        results,
        summary: {
          total: items.length,
          success: successCount,
          failed: failedCount,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "Batch top-up error");
    return res.status(500).json({
      success: false,
      error: "Failed to process batch top-up",
    });
  }
});

/**
 * GET /api/topup/batch/:payoutId
 * Get status of all shifts in a batch
 * Note: Authentication is optional for public access
 */
router.get("/batch/:payoutId", async (req, res) => {
  try {
    const { payoutId } = req.params;

    const jobs = store.getShiftJobsByPayoutId(payoutId);

    if (jobs.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Batch not found",
      });
    }

    return res.json({
      success: true,
      data: {
        payoutId,
        jobs,
        summary: {
          total: jobs.length,
          completed: jobs.filter((j) => j.status === "settled").length,
          pending: jobs.filter((j) =>
            ["waiting", "pending", "processing"].includes(j.status)
          ).length,
          failed: jobs.filter((j) =>
            ["refunded", "refunding"].includes(j.status)
          ).length,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get batch status");
    return res.status(500).json({
      success: false,
      error: "Failed to get batch status",
    });
  }
});

export default router;
