/**
 * Gas Oracle Routes - Real-time gas prices and smart presets
 * Wave 3 Feature: Live Gas Intelligence
 */

import { Router } from "express";
import { rateLimitConfig } from "../middleware/rateLimit";
import gasOracle from "../services/gasOracle";
import { logger } from "../utils/logger";

const router = Router();

/**
 * Normalize chain name to short code
 */
function normalizeChain(chain: string): string {
  const mapping: Record<string, string> = {
    ethereum: "eth",
    polygon: "pol",
    arbitrum: "arb",
    optimism: "op",
    avalanche: "avax",
    base: "base",
  };
  return mapping[chain.toLowerCase()] || chain.toLowerCase();
}

/**
 * GET /api/gas/prices
 * Get current gas prices for all supported chains
 */
router.get("/prices", rateLimitConfig.general, async (_req, res) => {
  try {
    const prices = await gasOracle.getAllGasPrices();

    res.json({
      success: true,
      data: prices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get gas prices");
    res.status(500).json({
      success: false,
      error: "Failed to fetch gas prices",
    });
  }
});

/**
 * GET /api/gas/price/:chain
 * Get current gas price for a specific chain
 */
router.get("/price/:chain", rateLimitConfig.general, async (req, res) => {
  try {
    const chain = normalizeChain(req.params.chain);
    const gasPrice = await gasOracle.getGasPrice(chain);

    res.json({
      success: true,
      data: gasPrice,
    });
  } catch (error) {
    logger.error({ error, chain: req.params.chain }, "Failed to get gas price");
    res.status(500).json({
      success: false,
      error: "Failed to fetch gas price",
    });
  }
});

/**
 * GET /api/gas/presets/:chain
 * Get smart presets for a specific chain based on current gas prices
 */
router.get("/presets/:chain", rateLimitConfig.general, async (req, res) => {
  try {
    const chain = normalizeChain(req.params.chain);
    const presets = await gasOracle.getSmartPresets(chain);
    const gasPrice = await gasOracle.getGasPrice(chain);

    res.json({
      success: true,
      data: {
        chain,
        currentGasGwei: gasPrice.gasPriceGwei,
        costPerTx: {
          native: gasPrice.costPerTxNative,
          usd: gasPrice.costPerTxUsd,
        },
        presets,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error, chain: req.params.chain },
      "Failed to get smart presets"
    );
    res.status(500).json({
      success: false,
      error: "Failed to fetch smart presets",
    });
  }
});

/**
 * GET /api/gas/score/:chain/:balance
 * Calculate OctaneScore (gas health) for a wallet balance
 */
router.get(
  "/score/:chain/:balance",
  rateLimitConfig.general,
  async (req, res): Promise<void> => {
    try {
      const chain = normalizeChain(req.params.chain);
      const balanceNum = parseFloat(req.params.balance);

      if (isNaN(balanceNum) || balanceNum < 0) {
        res.status(400).json({
          success: false,
          error: "Invalid balance value",
        });
        return;
      }

      const score = await gasOracle.calculateOctaneScore(chain, balanceNum);

      res.json({
        success: true,
        data: {
          chain,
          balance: balanceNum,
          ...score,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to calculate OctaneScore");
      res.status(500).json({
        success: false,
        error: "Failed to calculate gas score",
      });
    }
  }
);

/**
 * GET /api/gas/suggest/:chain/:usage
 * Get suggested gas amount based on intended usage
 */
router.get(
  "/suggest/:chain/:usage",
  rateLimitConfig.general,
  async (req, res): Promise<void> => {
    try {
      const chain = normalizeChain(req.params.chain);
      const { usage } = req.params;
      const validUsages = ["light", "medium", "heavy", "mint", "defi"];

      if (!validUsages.includes(usage)) {
        res.status(400).json({
          success: false,
          error: `Invalid usage. Must be one of: ${validUsages.join(", ")}`,
        });
        return;
      }

      const suggestion = await gasOracle.suggestGasAmount(
        chain,
        usage as "light" | "medium" | "heavy" | "mint" | "defi"
      );

      res.json({
        success: true,
        data: {
          chain,
          usage,
          ...suggestion,
        },
      });
    } catch (error) {
      logger.error({ error }, "Failed to get gas suggestion");
      res.status(500).json({
        success: false,
        error: "Failed to suggest gas amount",
      });
    }
  }
);

/**
 * GET /api/gas/arrival/:chain
 * Get gas-on-arrival recommendation for destination chain
 */
router.get("/arrival/:chain", rateLimitConfig.general, async (req, res) => {
  try {
    const { chain } = req.params;
    const recommendation = await gasOracle.getGasOnArrivalRecommendation(chain);

    res.json({
      success: true,
      data: {
        chain,
        ...recommendation,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get gas-on-arrival recommendation");
    res.status(500).json({
      success: false,
      error: "Failed to get recommendation",
    });
  }
});

export default router;
