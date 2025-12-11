/**
 * Gas-on-Arrival Routes - Attach gas to any swap
 * Wave 3 Feature: Never land without gas
 */

import { Router } from "express";
import { z } from "zod";
import sideshift from "../lib/sideshift";
import { rateLimitConfig } from "../middleware/rateLimit";
import gasOracle from "../services/gasOracle";
import { logger } from "../utils/logger";

const router = Router();

// Schema for gas-on-arrival request
const GasOnArrivalSchema = z.object({
  // Main swap details
  depositCoin: z.string().min(1),
  depositNetwork: z.string().min(1),
  settleCoin: z.string().min(1),
  settleNetwork: z.string().min(1),
  settleAddress: z.string().min(1),
  settleMemo: z.string().optional(),
  refundAddress: z.string().optional(),

  // Gas-on-arrival options
  addGasOnArrival: z.boolean().default(false),
  gasAmount: z.string().optional(), // If not provided, use recommendation
  gasDestChain: z.string().optional(), // Defaults to settleNetwork chain
});

/**
 * Get chain alias from network name
 */
function getChainAlias(network: string): string {
  const mapping: Record<string, string> = {
    ethereum: "eth",
    base: "base",
    arbitrum: "arb",
    optimism: "op",
    polygon: "pol",
    avalanche: "avax",
  };
  return mapping[network.toLowerCase()] || network;
}

/**
 * Get native gas token for a chain
 */
function getNativeToken(chain: string): { coin: string; network: string } {
  const mapping: Record<string, { coin: string; network: string }> = {
    eth: { coin: "ETH", network: "ethereum" },
    base: { coin: "ETH", network: "base" },
    arb: { coin: "ETH", network: "arbitrum" },
    op: { coin: "ETH", network: "optimism" },
    pol: { coin: "POL", network: "polygon" },
    avax: { coin: "AVAX", network: "avalanche" },
  };
  return mapping[chain] || { coin: "ETH", network: "ethereum" };
}

/**
 * POST /api/gas-on-arrival/quote
 * Get combined quote for swap + gas-on-arrival
 */
router.post(
  "/quote",
  rateLimitConfig.general,
  async (req, res): Promise<void> => {
    try {
      const validation = GasOnArrivalSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request",
          details: validation.error.errors,
        });
        return;
      }

      const data = validation.data;

      // Get main swap pair info using getPair with correct format
      const mainPair = await sideshift.getPair({
        from: `${data.depositCoin}-${data.depositNetwork}`,
        to: `${data.settleCoin}-${data.settleNetwork}`,
      });

      // If gas-on-arrival is requested, get gas quote too
      let gasQuote = null;
      let gasRecommendation = null;

      if (data.addGasOnArrival) {
        const destChain =
          data.gasDestChain || getChainAlias(data.settleNetwork);
        gasRecommendation = await gasOracle.getGasOnArrivalRecommendation(
          destChain
        );

        const nativeToken = getNativeToken(destChain);
        const gasAmount =
          data.gasAmount || gasRecommendation.recommended.toString();

        // Get pair info for gas swap
        const gasPair = await sideshift.getPair({
          from: `${data.depositCoin}-${data.depositNetwork}`,
          to: `${nativeToken.coin}-${nativeToken.network}`,
        });

        gasQuote = {
          destChain,
          nativeToken: nativeToken.coin,
          amount: gasAmount,
          pair: gasPair,
          recommendation: gasRecommendation,
        };
      }

      res.json({
        success: true,
        data: {
          mainSwap: {
            pair: mainPair,
            from: `${data.depositCoin}-${data.depositNetwork}`,
            to: `${data.settleCoin}-${data.settleNetwork}`,
          },
          gasOnArrival: gasQuote,
          combined: {
            hasGasOnArrival: data.addGasOnArrival,
            totalDepositsRequired: data.addGasOnArrival ? 2 : 1,
          },
        },
      });
    } catch (error: any) {
      logger.error({ error }, "Failed to get gas-on-arrival quote");
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get quote",
      });
    }
  }
);

/**
 * POST /api/gas-on-arrival/create
 * Create shifts for swap + gas-on-arrival in one flow
 */
router.post(
  "/create",
  rateLimitConfig.shiftCreation,
  async (req, res): Promise<void> => {
    try {
      const validation = GasOnArrivalSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: "Invalid request",
          details: validation.error.errors,
        });
        return;
      }

      const data = validation.data;
      const userIp = (req as any).clientIp;

      // Create main swap shift
      const mainShift = await sideshift.createVariableShift(
        {
          depositCoin: data.depositCoin,
          depositNetwork: data.depositNetwork,
          settleCoin: data.settleCoin,
          settleNetwork: data.settleNetwork,
          settleAddress: data.settleAddress,
          ...(data.settleMemo && { settleMemo: data.settleMemo }),
          ...(data.refundAddress && { refundAddress: data.refundAddress }),
        },
        userIp
      );

      // Create gas-on-arrival shift if requested
      let gasShiftData: {
        shiftId: string;
        depositAddress: string;
        depositCoin: string;
        depositNetwork: string;
        settleCoin: string;
        settleNetwork: string;
        status: string;
        gasInfo: {
          destChain: string;
          recommendedAmount: number;
          symbol: string;
          usdValue: number;
        };
      } | null = null;

      if (data.addGasOnArrival) {
        const destChain =
          data.gasDestChain || getChainAlias(data.settleNetwork);
        const gasRecommendation = await gasOracle.getGasOnArrivalRecommendation(
          destChain
        );
        const nativeToken = getNativeToken(destChain);

        const gasShift = await sideshift.createVariableShift(
          {
            depositCoin: data.depositCoin,
            depositNetwork: data.depositNetwork,
            settleCoin: nativeToken.coin,
            settleNetwork: nativeToken.network,
            settleAddress: data.settleAddress,
            ...(data.refundAddress && { refundAddress: data.refundAddress }),
          },
          userIp
        );

        gasShiftData = {
          shiftId: gasShift.id,
          depositAddress: gasShift.depositAddress,
          depositCoin: gasShift.depositCoin,
          depositNetwork: gasShift.depositNetwork,
          settleCoin: gasShift.settleCoin,
          settleNetwork: gasShift.settleNetwork,
          status: gasShift.status,
          gasInfo: {
            destChain,
            recommendedAmount: gasRecommendation.recommended,
            symbol: gasRecommendation.symbol,
            usdValue: gasRecommendation.usdValue,
          },
        };
      }

      res.json({
        success: true,
        data: {
          mainSwap: {
            shiftId: mainShift.id,
            depositAddress: mainShift.depositAddress,
            depositCoin: mainShift.depositCoin,
            depositNetwork: mainShift.depositNetwork,
            settleCoin: mainShift.settleCoin,
            settleNetwork: mainShift.settleNetwork,
            status: mainShift.status,
          },
          gasOnArrival: gasShiftData,
          instructions: {
            step1: `Send ${data.depositCoin} to main swap address: ${mainShift.depositAddress}`,
            step2: gasShiftData
              ? `Send ${data.depositCoin} to gas address: ${gasShiftData.depositAddress}`
              : null,
            note: gasShiftData
              ? "You will receive your tokens AND native gas on the destination chain!"
              : "You will receive your tokens on the destination chain.",
          },
        },
      });
    } catch (error: any) {
      logger.error({ error }, "Failed to create gas-on-arrival shifts");
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create shifts",
      });
    }
  }
);

/**
 * GET /api/gas-on-arrival/recommendation/:chain
 * Get recommended gas amount for a destination chain
 */
router.get(
  "/recommendation/:chain",
  rateLimitConfig.general,
  async (req, res) => {
    try {
      const { chain } = req.params;
      const recommendation = await gasOracle.getGasOnArrivalRecommendation(
        chain
      );

      res.json({
        success: true,
        data: recommendation,
      });
    } catch (error) {
      logger.error({ error }, "Failed to get gas recommendation");
      res.status(500).json({
        success: false,
        error: "Failed to get recommendation",
      });
    }
  }
);

export default router;
