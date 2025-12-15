/**
 * Wallet Balance Routes
 * Real on-chain balance fetching for EVM chains
 */

import { Router } from "express";
import { z } from "zod";
import {
  ChainAlias,
  formatBalance,
  getChainConfig,
  getNativeBalance,
  getSupportedChains,
  isValidEvmAddress,
} from "../lib/chains";
import {
  getAllGasPrices,
  getGasPrice,
  getNativePrices,
} from "../services/gasOracle";
import { logger } from "../utils/logger";

const router = Router();

// Simple in-memory cache for balance requests (60 seconds)
const balanceCache = new Map<
  string,
  { balance: bigint; timestamp: number; formatted: string }
>();
const BALANCE_CACHE_TTL = 60 * 1000; // 60 seconds

// ============================================
// SCHEMAS
// ============================================

const GetBalanceSchema = z.object({
  chain: z.enum(["eth", "base", "arb", "op", "pol", "avax"]),
  address: z.string().refine(isValidEvmAddress, "Invalid EVM address"),
});

const GetMultiBalanceSchema = z.object({
  address: z.string().refine(isValidEvmAddress, "Invalid EVM address"),
  chains: z
    .array(z.enum(["eth", "base", "arb", "op", "pol", "avax"]))
    .optional(),
});

// ============================================
// ENDPOINTS
// ============================================

/**
 * GET /api/wallets/balance/:chain/:address
 * Get native token balance for a specific chain
 */
router.get("/balance/:chain/:address", async (req, res) => {
  try {
    const { chain, address } = req.params;

    // Validate inputs
    const validation = GetBalanceSchema.safeParse({ chain, address });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid parameters",
        details: validation.error.errors,
      });
    }

    const chainAlias = chain as ChainAlias;
    const cacheKey = `${chainAlias}:${address.toLowerCase()}`;

    // Check cache
    const cached = balanceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
      const config = getChainConfig(chainAlias);
      return res.json({
        success: true,
        data: {
          chain: chainAlias,
          chainName: config.name,
          address,
          balance: cached.formatted,
          balanceWei: cached.balance.toString(),
          symbol: config.nativeCurrency.symbol,
          cached: true,
        },
      });
    }

    // Fetch real balance
    const balance = await getNativeBalance(chainAlias, address);
    const config = getChainConfig(chainAlias);
    const formatted = formatBalance(balance, config.nativeCurrency.decimals);

    // Cache the result
    balanceCache.set(cacheKey, {
      balance,
      formatted,
      timestamp: Date.now(),
    });

    return res.json({
      success: true,
      data: {
        chain: chainAlias,
        chainName: config.name,
        address,
        balance: formatted,
        balanceWei: balance.toString(),
        symbol: config.nativeCurrency.symbol,
        cached: false,
      },
    });
  } catch (error: any) {
    logger.error({ error, params: req.params }, "Failed to fetch balance");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch balance",
    });
  }
});

/**
 * POST /api/wallets/balances
 * Get balances across multiple chains for an address
 */
router.post("/balances", async (req, res) => {
  try {
    const validation = GetMultiBalanceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid parameters",
        details: validation.error.errors,
      });
    }

    const { address, chains: requestedChains } = validation.data;
    const chainsToQuery = requestedChains || getSupportedChains();

    // Fetch balances in parallel
    const results = await Promise.allSettled(
      chainsToQuery.map(async (chainAlias) => {
        const cacheKey = `${chainAlias}:${address.toLowerCase()}`;
        const cached = balanceCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < BALANCE_CACHE_TTL) {
          return {
            chain: chainAlias,
            balance: cached.formatted,
            balanceWei: cached.balance.toString(),
            cached: true,
          };
        }

        const balance = await getNativeBalance(
          chainAlias as ChainAlias,
          address
        );
        const config = getChainConfig(chainAlias as ChainAlias);
        const formatted = formatBalance(
          balance,
          config.nativeCurrency.decimals
        );

        balanceCache.set(cacheKey, {
          balance,
          formatted,
          timestamp: Date.now(),
        });

        return {
          chain: chainAlias,
          balance: formatted,
          balanceWei: balance.toString(),
          cached: false,
        };
      })
    );

    // Get native token prices
    const nativePrices = await getNativePrices().catch(() => ({
      eth: 2200,
      pol: 0.5,
      avax: 35,
    }));

    // Map chain to price key
    const getPriceKey = (chain: string): string => {
      const keys: Record<string, string> = {
        eth: "eth",
        base: "eth",
        arb: "eth",
        op: "eth",
        pol: "pol",
        avax: "avax",
      };
      return keys[chain] || "eth";
    };

    // Build response with gas context
    const balances = await Promise.all(
      results.map(async (result, index) => {
        const chainAlias = chainsToQuery[index] as ChainAlias;
        const config = getChainConfig(chainAlias);

        // Get gas price for this chain
        let costPerTxNative = 0;
        try {
          const gasInfo = await getGasPrice(chainAlias);
          costPerTxNative = gasInfo?.costPerTxNative || 0;
        } catch {
          // Use fallback cost estimate
          costPerTxNative = chainAlias === "eth" ? 0.001 : 0.0001;
        }

        const priceKey = getPriceKey(chainAlias);
        const usdPrice =
          (nativePrices as Record<string, number>)[priceKey] || 2000;

        if (result.status === "fulfilled") {
          const balanceNum = parseFloat(result.value.balance) || 0;
          const balanceUSD = balanceNum * usdPrice;
          const txsRemaining =
            costPerTxNative > 0
              ? Math.floor(balanceNum / costPerTxNative)
              : 100;

          // Determine health status
          let healthStatus: "healthy" | "low" | "critical" = "healthy";
          if (txsRemaining <= 5) healthStatus = "critical";
          else if (txsRemaining <= 20) healthStatus = "low";

          return {
            chain: chainAlias,
            chainName: config.name,
            symbol: config.nativeCurrency.symbol,
            balance: balanceNum,
            balanceFormatted: result.value.balance,
            balanceUSD,
            balanceWei: result.value.balanceWei,
            txsRemaining,
            healthStatus,
            costPerTx: costPerTxNative,
            error: null,
          };
        } else {
          return {
            chain: chainAlias,
            chainName: config.name,
            symbol: config.nativeCurrency.symbol,
            balance: 0,
            balanceFormatted: "0",
            balanceUSD: 0,
            balanceWei: "0",
            txsRemaining: 0,
            healthStatus: "critical" as const,
            costPerTx: 0,
            error: result.reason?.message || "Failed to fetch",
          };
        }
      })
    );

    return res.json({
      success: true,
      data: {
        address,
        balances,
        totalChains: balances.length,
        healthyChains: balances.filter((b) => b.healthStatus === "healthy")
          .length,
        criticalChains: balances.filter((b) => b.healthStatus === "critical")
          .length,
      },
    });
  } catch (error: any) {
    logger.error({ error }, "Failed to fetch multi-chain balances");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch balances",
    });
  }
});

/**
 * GET /api/wallets/health/:address
 * Get overall wallet health score across all chains
 */
router.get("/health/:address", async (req, res) => {
  try {
    const { address } = req.params;

    if (!isValidEvmAddress(address)) {
      return res.status(400).json({
        success: false,
        error: "Invalid EVM address",
      });
    }

    const chains = getSupportedChains();
    const gasPrices = await getAllGasPrices().catch(() => ({}));

    // Fetch all balances
    const results = await Promise.allSettled(
      chains.map(async (chain) => {
        const balance = await getNativeBalance(chain, address);
        const config = getChainConfig(chain);
        return {
          chain,
          balance,
          config,
        };
      })
    );

    let totalHealthScore = 0;
    const chainsWithIssues: string[] = [];
    const chainScores: Record<
      string,
      { score: number; txsRemaining: number; recommendation: string }
    > = {};

    results.forEach((result, index) => {
      const chainAlias = chains[index];
      const gasInfo = (gasPrices as any)[chainAlias];
      const costPerTx = gasInfo?.costPerTxNative || 0.001;

      if (result.status === "fulfilled") {
        const { balance, config } = result.value;
        const balanceNum =
          parseFloat(formatBalance(balance, config.nativeCurrency.decimals)) ||
          0;
        const txsRemaining = costPerTx > 0 ? balanceNum / costPerTx : 0;

        let score = 100;
        let recommendation = "Healthy";

        if (txsRemaining <= 1) {
          score = 0;
          recommendation = "Critical! Top up immediately";
          chainsWithIssues.push(config.name);
        } else if (txsRemaining <= 5) {
          score = 25;
          recommendation = "Low - consider topping up";
          chainsWithIssues.push(config.name);
        } else if (txsRemaining <= 20) {
          score = 50;
          recommendation = "Moderate - monitor usage";
        } else if (txsRemaining <= 50) {
          score = 75;
          recommendation = "Good";
        }

        chainScores[chainAlias] = {
          score,
          txsRemaining: Math.floor(txsRemaining),
          recommendation,
        };
        totalHealthScore += score;
      } else {
        chainScores[chainAlias] = {
          score: 0,
          txsRemaining: 0,
          recommendation: "Unable to check",
        };
      }
    });

    const avgHealthScore = Math.round(totalHealthScore / chains.length);

    return res.json({
      success: true,
      data: {
        address,
        overallScore: avgHealthScore,
        overallStatus:
          avgHealthScore >= 75
            ? "healthy"
            : avgHealthScore >= 50
            ? "moderate"
            : avgHealthScore >= 25
            ? "low"
            : "critical",
        chainsWithIssues,
        chainScores,
        recommendation:
          chainsWithIssues.length > 0
            ? `Top up gas on: ${chainsWithIssues.join(", ")}`
            : "All chains have adequate gas",
      },
    });
  } catch (error: any) {
    logger.error({ error }, "Failed to calculate wallet health");
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to calculate health",
    });
  }
});

export default router;
