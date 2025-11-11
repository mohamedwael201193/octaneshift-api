import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { rateLimitConfig } from "../middleware/rateLimit";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = express.Router();

// ============================================
// WATCHLIST CRUD ENDPOINTS
// ============================================

/**
 * POST /api/watchlists
 * Create a new watchlist
 * Requires: Bearer token authentication
 */
router.post(
  "/watchlists",
  rateLimitConfig.watchlistCreation,
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!; // Guaranteed by authenticateToken
      const { address, chain, thresholdNative } = req.body;

      // Validate required fields
      if (!address || !chain || thresholdNative === undefined) {
        res.status(400).json({
          error: "Missing required fields",
          required: ["address", "chain", "thresholdNative"],
        });
        return;
      }

      // Validate chain
      const validChains = ["eth", "base", "arb", "op", "pol", "avax"];
      if (!validChains.includes(chain)) {
        res.status(400).json({
          error: "Invalid chain",
          validChains,
        });
        return;
      }

      // Validate address format (basic check)
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        res.status(400).json({
          error: "Invalid address format",
          message: "Address must be a valid Ethereum address (0x...)",
        });
        return;
      }

      // Validate threshold
      if (typeof thresholdNative !== "number" || thresholdNative <= 0) {
        res.status(400).json({
          error: "Invalid threshold",
          message: "thresholdNative must be a positive number",
        });
        return;
      }

      // Check for duplicate watchlist (same user, address, chain)
      const existingWatchlists = store.getWatchlistsByUserId(userId);
      const duplicate = existingWatchlists.find(
        (w) =>
          w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
      );

      if (duplicate) {
        res.status(409).json({
          error: "Duplicate watchlist",
          message: "A watchlist for this address and chain already exists",
          existingWatchlist: duplicate,
        });
        return;
      }

      // Create watchlist
      const watchlist = store.createWatchlist({
        userId,
        address: address.toLowerCase(), // Normalize address
        chain,
        thresholdNative,
      });

      logger.info({ watchlistId: watchlist.id, userId }, "Watchlist created");

      res.status(201).json({
        success: true,
        watchlist,
      });
    } catch (error) {
      logger.error({ error }, "Error creating watchlist");
      res.status(500).json({
        error: "Failed to create watchlist",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * GET /api/watchlists
 * Get all watchlists for the authenticated user
 * Query param: ?userId=<id> (optional, for admin use)
 * Requires: Bearer token authentication
 */
router.get(
  "/watchlists",
  rateLimitConfig.general,
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authenticatedUserId = req.userId!;
      const queryUserId = req.query.userId as string | undefined;

      // If userId is provided in query, use it (for admin/testing)
      // In production, you'd check if user has admin privileges
      const userId = queryUserId || authenticatedUserId;

      const watchlists = store.getWatchlistsByUserId(userId);

      logger.debug(
        { userId, count: watchlists.length },
        "Watchlists retrieved"
      );

      res.json({
        success: true,
        count: watchlists.length,
        watchlists,
      });
    } catch (error) {
      logger.error({ error }, "Error retrieving watchlists");
      res.status(500).json({
        error: "Failed to retrieve watchlists",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * GET /api/watchlists/:id
 * Get a specific watchlist by ID
 * Requires: Bearer token authentication
 */
router.get(
  "/watchlists/:id",
  rateLimitConfig.general,
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const watchlist = store.getWatchlist(id);

      if (!watchlist) {
        res.status(404).json({
          error: "Watchlist not found",
          message: `No watchlist found with ID: ${id}`,
        });
        return;
      }

      // Verify ownership
      if (watchlist.userId !== userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "You do not have permission to access this watchlist",
        });
        return;
      }

      logger.debug({ watchlistId: id, userId }, "Watchlist retrieved");

      res.json({
        success: true,
        watchlist,
      });
    } catch (error) {
      logger.error({ error }, "Error retrieving watchlist");
      res.status(500).json({
        error: "Failed to retrieve watchlist",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * PUT /api/watchlists/:id
 * Update a watchlist
 * Requires: Bearer token authentication
 */
router.put(
  "/watchlists/:id",
  rateLimitConfig.general,
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const { address, chain, thresholdNative } = req.body;

      const watchlist = store.getWatchlist(id);

      if (!watchlist) {
        res.status(404).json({
          error: "Watchlist not found",
          message: `No watchlist found with ID: ${id}`,
        });
        return;
      }

      // Verify ownership
      if (watchlist.userId !== userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "You do not have permission to update this watchlist",
        });
        return;
      }

      // Prepare updates
      const updates: Partial<
        Omit<store.Watchlist, "id" | "createdAt" | "userId">
      > = {};

      if (address !== undefined) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          res.status(400).json({
            error: "Invalid address format",
            message: "Address must be a valid Ethereum address (0x...)",
          });
          return;
        }
        updates.address = address.toLowerCase();
      }

      if (chain !== undefined) {
        const validChains = ["eth", "base", "arb", "op", "pol", "avax"];
        if (!validChains.includes(chain)) {
          res.status(400).json({
            error: "Invalid chain",
            validChains,
          });
          return;
        }
        updates.chain = chain;
      }

      if (thresholdNative !== undefined) {
        if (typeof thresholdNative !== "number" || thresholdNative <= 0) {
          res.status(400).json({
            error: "Invalid threshold",
            message: "thresholdNative must be a positive number",
          });
          return;
        }
        updates.thresholdNative = thresholdNative;
      }

      // Check if no updates provided
      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          error: "No updates provided",
          message: "At least one field must be provided to update",
        });
        return;
      }

      // Update watchlist
      const updatedWatchlist = store.updateWatchlist(id, updates);

      logger.info({ watchlistId: id, userId, updates }, "Watchlist updated");

      res.json({
        success: true,
        watchlist: updatedWatchlist,
      });
    } catch (error) {
      logger.error({ error }, "Error updating watchlist");
      res.status(500).json({
        error: "Failed to update watchlist",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * DELETE /api/watchlists/:id
 * Delete a watchlist
 * Requires: Bearer token authentication
 */
router.delete(
  "/watchlists/:id",
  rateLimitConfig.general,
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const watchlist = store.getWatchlist(id);

      if (!watchlist) {
        res.status(404).json({
          error: "Watchlist not found",
          message: `No watchlist found with ID: ${id}`,
        });
        return;
      }

      // Verify ownership
      if (watchlist.userId !== userId) {
        res.status(403).json({
          error: "Forbidden",
          message: "You do not have permission to delete this watchlist",
        });
        return;
      }

      // Delete watchlist
      const deleted = store.deleteWatchlist(id);

      if (!deleted) {
        res.status(500).json({
          error: "Failed to delete watchlist",
          message: "An error occurred while deleting the watchlist",
        });
        return;
      }

      logger.info({ watchlistId: id, userId }, "Watchlist deleted");

      res.json({
        success: true,
        message: "Watchlist deleted successfully",
        watchlistId: id,
      });
    } catch (error) {
      logger.error({ error }, "Error deleting watchlist");
      res.status(500).json({
        error: "Failed to delete watchlist",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
