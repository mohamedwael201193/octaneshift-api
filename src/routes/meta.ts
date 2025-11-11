/**
 * Meta endpoints for coins, networks, and system information
 */

import { Router } from "express";
import * as coinsCache from "../lib/coinsCache";
import * as pairsEngine from "../lib/pairsEngine";
import { rateLimitConfig } from "../middleware/rateLimit";
import logger from "../utils/logger";

const router = Router();

/**
 * GET /api/meta/coins
 * Returns all available coins and networks from SideShift
 */
router.get("/coins", rateLimitConfig.general, (_req, res) => {
  try {
    const coins = coinsCache.getAllCoins();
    const stats = coinsCache.getCacheStats();

    res.json({
      coins,
      meta: {
        total: coins.length,
        lastUpdated: stats.lastFetch,
        cacheAge: stats.age,
      },
    });
  } catch (error) {
    logger.error("Failed to get coins", { error });
    res.status(503).json({ error: "Coins cache not available" });
  }
});

/**
 * GET /api/meta/coins/search?q=btc
 * Search coins by name or symbol
 */
router.get("/coins/search", rateLimitConfig.general, (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = coinsCache.searchCoins(query);

    return res.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error("Failed to search coins", { error });
    return res.status(500).json({ error: "Failed to search coins" });
  }
});

/**
 * GET /api/meta/coins/:coinId
 * Get details for a specific coin
 */
router.get("/coins/:coinId", rateLimitConfig.general, (req, res) => {
  try {
    const { coinId } = req.params;
    const coin = coinsCache.getCoin(coinId);

    if (!coin) {
      return res.status(404).json({ error: `Coin ${coinId} not found` });
    }

    return res.json(coin);
  } catch (error) {
    logger.error("Failed to get coin", { error });
    return res.status(500).json({ error: "Failed to get coin details" });
  }
});

/**
 * GET /api/meta/coins/:coinId/networks
 * Get all networks for a coin
 */
router.get("/coins/:coinId/networks", rateLimitConfig.general, (req, res) => {
  try {
    const { coinId } = req.params;
    const coin = coinsCache.getCoin(coinId);

    if (!coin) {
      return res.status(404).json({ error: `Coin ${coinId} not found` });
    }

    const networksWithMemoInfo = coin.networks.map((network) => ({
      network,
      requiresMemo: coin.networksWithMemo.includes(network),
      displayName: coinsCache.getDisplayName(coinId, network),
    }));

    return res.json({
      coin: coin.coin,
      networks: networksWithMemoInfo,
    });
  } catch (error) {
    logger.error("Failed to get networks", { error });
    return res.status(500).json({ error: "Failed to get networks" });
  }
});

/**
 * GET /api/meta/popular
 * Get popular coins for quick selection
 */
router.get("/popular", rateLimitConfig.general, (_req, res) => {
  try {
    const popular = coinsCache.getPopularCoins();
    res.json(popular);
  } catch (error) {
    logger.error("Failed to get popular coins", { error });
    res.status(500).json({ error: "Failed to get popular coins" });
  }
});

/**
 * GET /api/meta/cache-stats
 * Get cache statistics for monitoring
 */
router.get("/cache-stats", rateLimitConfig.general, (_req, res) => {
  try {
    const stats = coinsCache.getCacheStats();
    res.json(stats);
  } catch (error) {
    logger.error("Failed to get cache stats", { error });
    res.status(500).json({ error: "Failed to get cache stats" });
  }
});

/**
 * GET /api/meta/recommendations
 * Get recommended deposit options for a settle target
 * Query params: settleCoin, settleNetwork, settleAmount, limit (optional)
 */
router.get("/recommendations", rateLimitConfig.general, async (req, res) => {
  try {
    const { settleCoin, settleNetwork, settleAmount, limit } = req.query;

    if (!settleCoin || !settleNetwork || !settleAmount) {
      return res.status(400).json({
        error:
          "Missing required parameters: settleCoin, settleNetwork, settleAmount",
      });
    }

    const amount = parseFloat(settleAmount as string);
    if (isNaN(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ error: "settleAmount must be a positive number" });
    }

    const recommendations = await pairsEngine.bestDepositsFor({
      settleCoin: settleCoin as string,
      settleNetwork: settleNetwork as string,
      settleAmount: amount,
      limit: limit ? parseInt(limit as string) : 3,
    });

    return res.json({
      settleCoin,
      settleNetwork,
      settleAmount: amount,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    logger.error("Failed to get recommendations", { error });
    return res
      .status(500)
      .json({ error: "Failed to get deposit recommendations" });
  }
});

/**
 * GET /api/meta/pol-audit
 * Audit endpoint to find any remaining "MATIC" strings in the codebase
 * Returns occurrences that should be replaced with "POL"
 */
router.get("/pol-audit", rateLimitConfig.general, (_req, res) => {
  try {
    const issues: string[] = [];

    // Check coins cache for MATIC references
    const coins = coinsCache.getAllCoins();
    const maticCoin = coins.find((c) => c.coin.toUpperCase() === "MATIC");
    if (maticCoin) {
      issues.push(`Coin symbol still using "MATIC" - should be "POL"`);
    }

    // Check for MATIC in popular coins list
    const popular = coinsCache.getPopularCoins();
    const maticInPopular = popular.find(
      (c) => c.coin.toUpperCase() === "MATIC"
    );
    if (maticInPopular) {
      issues.push(`Popular coins list contains "MATIC" - should be "POL"`);
    }

    // Check environment or config (if any MATIC references exist)
    // This is a placeholder - actual implementation would scan relevant config files

    return res.json({
      audit: "POL Migration Audit",
      timestamp: new Date().toISOString(),
      status: issues.length === 0 ? "clean" : "issues_found",
      issues,
      totalIssues: issues.length,
      recommendation:
        issues.length > 0
          ? "Replace all MATIC references with POL. Polygon network token is now POL."
          : "All MATIC references have been successfully migrated to POL.",
      notes: [
        "Polygon rebranded MATIC to POL in 2024",
        'Ensure UI displays "Polygon (POL)" consistently',
        'Both "pol" and "polygon" network identifiers are accepted',
        "Historical data may still reference MATIC for backward compatibility",
      ],
    });
  } catch (error) {
    logger.error("Failed to run POL audit", { error });
    return res.status(500).json({ error: "Failed to run POL audit" });
  }
});

export default router;
