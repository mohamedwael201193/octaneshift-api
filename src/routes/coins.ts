import { NextFunction, Request, Response, Router } from "express";
import * as coinsCache from "../lib/coinsCache";
import { rateLimitConfig } from "../middleware/rateLimit";
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/coins
 * Get list of all supported coins from SideShift
 * Returns coins with their networks, deposit/settle capabilities
 */
router.get(
  "/",
  rateLimitConfig.general,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coins = coinsCache.getAllCoins();

      res.json({
        success: true,
        data: coins,
        count: coins.length,
      });
    } catch (error) {
      logger.error({ error }, "Error fetching coins list");
      next(error);
    }
  }
);

/**
 * GET /api/coins/:coin
 * Get specific coin information
 */
router.get(
  "/:coin",
  rateLimitConfig.general,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { coin } = req.params;
      const coinInfo = coinsCache.getCoin(coin.toLowerCase());

      if (!coinInfo) {
        res.status(404).json({
          success: false,
          error: `Coin '${coin}' not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: coinInfo,
      });
    } catch (error) {
      logger.error(
        { error, coin: req.params.coin },
        "Error fetching coin info"
      );
      next(error);
    }
  }
);

/**
 * GET /api/coins/networks/:network
 * Get all coins available on a specific network
 */
router.get(
  "/networks/:network",
  rateLimitConfig.general,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { network } = req.params;
      const allCoins = coinsCache.getAllCoins();
      const coins = allCoins.filter((coin: any) =>
        coin.networks?.includes(network.toLowerCase())
      );

      res.json({
        success: true,
        data: coins,
        count: coins.length,
        network,
      });
    } catch (error) {
      logger.error(
        { error, network: req.params.network },
        "Error fetching coins by network"
      );
      next(error);
    }
  }
);

/**
 * GET /api/coins/search/:query
 * Search coins by name or symbol
 */
router.get(
  "/search/:query",
  rateLimitConfig.general,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query } = req.params;
      const allCoins = coinsCache.getAllCoins();

      const searchLower = query.toLowerCase();
      const results = allCoins.filter(
        (coin: any) =>
          coin.coin?.toLowerCase().includes(searchLower) ||
          coin.name?.toLowerCase().includes(searchLower)
      );

      res.json({
        success: true,
        data: results,
        count: results.length,
        query,
      });
    } catch (error) {
      logger.error({ error, query: req.params.query }, "Error searching coins");
      next(error);
    }
  }
);

export default router;
