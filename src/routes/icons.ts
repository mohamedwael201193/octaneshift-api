import { NextFunction, Request, Response, Router } from "express";
import { request } from "undici";
import { logger } from "../utils/logger";

const router = Router();

// LRU Cache for coin icons (24-hour cache)
interface CachedIcon {
  data: Buffer;
  contentType: string;
  timestamp: number;
}

const iconCache = new Map<string, CachedIcon>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 500; // Maximum number of icons to cache

/**
 * Clean up expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of iconCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      iconCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug({ cleaned }, "Cleaned expired icon cache entries");
  }
}

/**
 * Evict oldest entries if cache is too large
 */
function evictOldestEntries(): void {
  if (iconCache.size <= MAX_CACHE_SIZE) return;

  // Convert to array and sort by timestamp
  const entries = Array.from(iconCache.entries()).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );

  // Remove oldest 20% of entries
  const toRemove = Math.floor(entries.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    iconCache.delete(entries[i][0]);
  }

  logger.debug({ removed: toRemove }, "Evicted oldest icon cache entries");
}

// Run cleanup every hour
setInterval(cleanupCache, 60 * 60 * 1000);

/**
 * GET /api/icons/:coinNetwork
 * Proxy coin icons from SideShift API with 24-hour caching
 * Example: /api/icons/btc-bitcoin, /api/icons/usdt-ethereum
 */
router.get(
  "/:coinNetwork",
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { coinNetwork } = req.params;

      if (!coinNetwork || !coinNetwork.includes("-")) {
        res.status(400).json({
          success: false,
          error:
            "Invalid coin-network format. Use format: coin-network (e.g., btc-bitcoin)",
        });
        return;
      }

      // Check cache first
      const cached = iconCache.get(coinNetwork);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logger.debug({ coinNetwork }, "Serving icon from cache");
        res.set("Content-Type", cached.contentType);
        res.set("Cache-Control", "public, max-age=86400"); // 24 hours
        res.set("X-Cache", "HIT");
        // CORS headers for cross-origin image loading
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Cross-Origin-Resource-Policy", "cross-origin");
        res.send(cached.data);
        return;
      }

      // Fetch from SideShift API
      const sideShiftUrl = `https://sideshift.ai/api/v2/coins/icon/${coinNetwork}`;
      logger.debug(
        { coinNetwork, url: sideShiftUrl },
        "Fetching icon from SideShift"
      );

      const response = await request(sideShiftUrl, {
        method: "GET",
        headers: {
          "User-Agent": "OctaneShift/1.0",
        },
      });

      if (response.statusCode !== 200) {
        logger.warn(
          { coinNetwork, status: response.statusCode },
          "Failed to fetch icon from SideShift"
        );

        // Return a placeholder SVG for missing icons
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="#374151"/>
          <text x="16" y="21" text-anchor="middle" fill="#9CA3AF" font-size="14" font-family="system-ui">?</text>
        </svg>`;

        res.set("Content-Type", "image/svg+xml");
        res.set("Cache-Control", "public, max-age=3600"); // 1 hour for placeholders
        // CORS headers for cross-origin image loading
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Cross-Origin-Resource-Policy", "cross-origin");
        res.send(placeholderSvg);
        return;
      }

      // Get content type from response
      const contentType =
        (response.headers["content-type"] as string) || "image/svg+xml";

      // Read the response body as buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.body) {
        chunks.push(Buffer.from(chunk));
      }
      const iconData = Buffer.concat(chunks);

      // Cache the icon
      evictOldestEntries();
      iconCache.set(coinNetwork, {
        data: iconData,
        contentType,
        timestamp: Date.now(),
      });

      logger.info(
        { coinNetwork, size: iconData.length },
        "Cached icon from SideShift"
      );

      // Send response
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400"); // 24 hours
      res.set("X-Cache", "MISS");
      // CORS headers for cross-origin image loading
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.send(iconData);
    } catch (error) {
      logger.error(
        { error, coinNetwork: req.params.coinNetwork },
        "Error fetching icon"
      );

      // Return placeholder on error
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" fill="#374151"/>
        <text x="16" y="21" text-anchor="middle" fill="#9CA3AF" font-size="14" font-family="system-ui">?</text>
      </svg>`;

      res.set("Content-Type", "image/svg+xml");
      res.set("Cache-Control", "public, max-age=300"); // 5 minutes for errors
      // CORS headers for cross-origin image loading
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.send(placeholderSvg);
    }
  }
);

/**
 * GET /api/icons/cache/stats
 * Get cache statistics (for debugging)
 */
router.get("/cache/stats", (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      size: iconCache.size,
      maxSize: MAX_CACHE_SIZE,
      ttlHours: CACHE_TTL / (60 * 60 * 1000),
    },
  });
});

export default router;
