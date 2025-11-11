import { Router } from "express";
import * as store from "../store/store";
import { logger } from "../utils/logger";

const router = Router();

// Server start time for uptime calculation
const serverStartTime = Date.now();

// Cache for status metrics (15-second cache to reduce load)
let statusCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_TTL = 15 * 1000; // 15 seconds

/**
 * GET /api/status
 * Public endpoint providing system health metrics
 * - Server uptime
 * - Shifts today
 * - Success rate (last 24h)
 * - Top chains (last 24h)
 * - Top coins (last 24h)
 */
router.get("/", async (_req, res) => {
  try {
    // Check cache
    if (statusCache && Date.now() - statusCache.timestamp < CACHE_TTL) {
      return res.json({
        success: true,
        data: statusCache.data,
        cached: true,
      });
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const todayStart = new Date().setHours(0, 0, 0, 0);

    // Get all shift jobs
    const allJobs = store.getAllShiftJobs();

    // Calculate uptime
    const uptimeSeconds = Math.floor((now - serverStartTime) / 1000);

    // Shifts today (from midnight)
    const shiftsToday = allJobs.filter(
      (job) => new Date(job.createdAt).getTime() >= todayStart
    ).length;

    // Last 24h metrics
    const last24hJobs = allJobs.filter(
      (job) => new Date(job.createdAt).getTime() >= oneDayAgo
    );

    const completedJobs = last24hJobs.filter((job) => job.status === "settled");
    const failedJobs = last24hJobs.filter((job) =>
      ["refunded", "refunding"].includes(job.status)
    );

    const successRate =
      last24hJobs.length > 0
        ? ((completedJobs.length / last24hJobs.length) * 100).toFixed(2)
        : "0.00";

    // Top chains (by settled shifts count)
    const chainCounts: { [chain: string]: number } = {};
    completedJobs.forEach((job) => {
      const chain = job.settleNetwork;
      chainCounts[chain] = (chainCounts[chain] || 0) + 1;
    });

    const topChains = Object.entries(chainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([chain, count]) => ({
        chain,
        count,
      }));

    // Top coins (by settled shifts count)
    const coinCounts: { [coin: string]: number } = {};
    completedJobs.forEach((job) => {
      const coin = `${job.settleCoin}/${job.settleNetwork}`;
      coinCounts[coin] = (coinCounts[coin] || 0) + 1;
    });

    const topCoins = Object.entries(coinCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([coin, count]) => ({
        coin,
        count,
      }));

    const statusData = {
      uptime: {
        seconds: uptimeSeconds,
        formatted: formatUptime(uptimeSeconds),
      },
      shifts: {
        today: shiftsToday,
        last24h: last24hJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
        pending: last24hJobs.filter((job) =>
          ["waiting", "pending", "processing"].includes(job.status)
        ).length,
      },
      successRate: parseFloat(successRate),
      topChains,
      topCoins,
    };

    // Update cache
    statusCache = {
      data: statusData,
      timestamp: now,
    };

    return res.json({
      success: true,
      data: statusData,
      cached: false,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get status");
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve status",
    });
  }
});

/**
 * Helper function to format uptime into human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

export default router;
