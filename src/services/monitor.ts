import crypto from "crypto";
import * as chains from "../lib/chains";
import * as store from "../store/store";
import { logger } from "../utils/logger";

// ============================================
// CONFIGURATION
// ============================================

const MONITOR_INTERVAL_MS = 60000; // Check every 60 seconds
const LOW_ALERT_MULTIPLIER = 1.5; // Alert when balance drops below threshold * 1.5

let monitorInterval: NodeJS.Timeout | null = null;
let isMonitoring = false;

// ============================================
// DEEP LINK SIGNING
// ============================================

/**
 * Sign a deep link with HMAC-SHA256 using JWT_SECRET
 * Returns a URL with signature parameter
 */
export function signDeepLink(
  baseUrl: string,
  params: Record<string, any>
): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET not configured for deep link signing");
  }

  // Sort parameters for consistent signing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);

  // Create parameter string
  const paramString = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");

  // Generate HMAC signature
  const hmac = crypto.createHmac("sha256", jwtSecret);
  hmac.update(paramString);
  const signature = hmac.digest("hex");

  // Build final URL
  const url = new URL(baseUrl);
  Object.entries(sortedParams).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set("sig", signature);

  return url.toString();
}

/**
 * Verify a deep link signature
 */
export function verifyDeepLink(url: string): boolean {
  try {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return false;
    }

    const parsedUrl = new URL(url);
    const signature = parsedUrl.searchParams.get("sig");

    if (!signature) {
      return false;
    }

    // Remove signature from params
    parsedUrl.searchParams.delete("sig");

    // Get sorted params
    const params: Record<string, string> = {};
    parsedUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, string>);

    // Recreate parameter string
    const paramString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    // Generate expected signature
    const hmac = crypto.createHmac("sha256", jwtSecret);
    hmac.update(paramString);
    const expectedSignature = hmac.digest("hex");

    return signature === expectedSignature;
  } catch (error) {
    logger.error({ error }, "Error verifying deep link");
    return false;
  }
}

// ============================================
// ALERT GENERATION
// ============================================

/**
 * Generate an alert for a watchlist with low balance
 */
async function generateAlert(
  watchlist: store.Watchlist,
  currentBalance: bigint,
  level: "low" | "critical"
): Promise<store.Alert | null> {
  try {
    const user = store.getUser(watchlist.userId);

    if (!user) {
      logger.warn(
        { watchlistId: watchlist.id },
        "User not found for watchlist"
      );
      return null;
    }

    // Get chain config
    const chainConfig = chains.getChainConfig(watchlist.chain);
    const formattedBalance = chains.formatBalance(
      currentBalance,
      chainConfig.nativeCurrency.decimals
    );

    // Build deep link to frontend
    const publicAppUrl =
      process.env.PUBLIC_APP_URL || "https://octaneshift.app";
    const deepLinkParams = {
      action: "topup",
      chain: watchlist.chain,
      address: watchlist.address,
      amount: watchlist.thresholdNative.toString(),
      watchlistId: watchlist.id,
      timestamp: Date.now().toString(),
    };

    const deepLink = signDeepLink(`${publicAppUrl}/topup`, deepLinkParams);

    // Create alert
    const alert = store.createAlert({
      userId: watchlist.userId,
      watchlistId: watchlist.id,
      level,
      deepLink,
    });

    logger.info(
      {
        alertId: alert.id,
        watchlistId: watchlist.id,
        userId: user.id,
        level,
        chain: watchlist.chain,
        address: watchlist.address,
        balance: formattedBalance,
        threshold: watchlist.thresholdNative,
      },
      "Alert generated"
    );

    // Update watchlist lastAlertAt
    store.updateWatchlist(watchlist.id, {
      lastAlertAt: alert.sentAt,
    });

    return alert;
  } catch (error) {
    logger.error(
      { error, watchlistId: watchlist.id },
      "Error generating alert"
    );
    return null;
  }
}

/**
 * Check if we should send an alert for this watchlist
 * Prevents alert spam by checking lastAlertAt
 */
function shouldSendAlert(watchlist: store.Watchlist): boolean {
  if (!watchlist.lastAlertAt) {
    return true;
  }

  // Only send alert if last alert was more than 1 hour ago
  const lastAlertTime = new Date(watchlist.lastAlertAt).getTime();
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;

  return now - lastAlertTime > hourInMs;
}

// ============================================
// MONITORING LOGIC
// ============================================

/**
 * Check a single watchlist and generate alerts if needed
 */
async function checkWatchlist(watchlist: store.Watchlist): Promise<void> {
  try {
    // Get current balance
    const balance = await chains.getNativeBalance(
      watchlist.chain,
      watchlist.address
    );
    const chainConfig = chains.getChainConfig(watchlist.chain);
    const formattedBalance = chains.formatBalance(
      balance,
      chainConfig.nativeCurrency.decimals
    );

    // Convert threshold to wei/smallest unit
    const thresholdWei = BigInt(
      Math.floor(
        watchlist.thresholdNative *
          Math.pow(10, chainConfig.nativeCurrency.decimals)
      )
    );
    const lowThresholdWei = BigInt(
      Math.floor(
        watchlist.thresholdNative *
          LOW_ALERT_MULTIPLIER *
          Math.pow(10, chainConfig.nativeCurrency.decimals)
      )
    );

    logger.debug(
      {
        watchlistId: watchlist.id,
        chain: watchlist.chain,
        address: watchlist.address,
        balance: formattedBalance,
        threshold: watchlist.thresholdNative,
      },
      "Checking watchlist balance"
    );

    // Check if balance is below critical threshold
    if (balance <= thresholdWei) {
      if (shouldSendAlert(watchlist)) {
        await generateAlert(watchlist, balance, "critical");
      }
    }
    // Check if balance is below low threshold
    else if (balance <= lowThresholdWei) {
      if (shouldSendAlert(watchlist)) {
        await generateAlert(watchlist, balance, "low");
      }
    }
  } catch (error) {
    logger.error(
      { error, watchlistId: watchlist.id, chain: watchlist.chain },
      "Error checking watchlist"
    );
  }
}

/**
 * Run monitoring cycle - check all watchlists
 */
async function runMonitorCycle(): Promise<void> {
  try {
    const watchlists = store.getAllWatchlists();

    if (watchlists.length === 0) {
      logger.debug("No watchlists to monitor");
      return;
    }

    logger.info({ count: watchlists.length }, "Starting monitor cycle");

    // Check all watchlists
    const checks = watchlists.map((watchlist) => checkWatchlist(watchlist));
    await Promise.allSettled(checks);

    logger.info("Monitor cycle completed");
  } catch (error) {
    logger.error({ error }, "Error in monitor cycle");
  }
}

// ============================================
// MONITOR CONTROL
// ============================================

/**
 * Start the monitoring service
 */
export function startMonitor(): void {
  if (isMonitoring) {
    logger.warn("Monitor already running");
    return;
  }

  logger.info({ intervalMs: MONITOR_INTERVAL_MS }, "Starting monitor service");

  // Run first cycle immediately
  runMonitorCycle().catch((error) => {
    logger.error({ error }, "Error in initial monitor cycle");
  });

  // Schedule periodic checks
  monitorInterval = setInterval(() => {
    runMonitorCycle().catch((error) => {
      logger.error({ error }, "Error in scheduled monitor cycle");
    });
  }, MONITOR_INTERVAL_MS);

  isMonitoring = true;
  logger.info("Monitor service started successfully");
}

/**
 * Stop the monitoring service
 */
export function stopMonitor(): void {
  if (!isMonitoring) {
    logger.warn("Monitor not running");
    return;
  }

  logger.info("Stopping monitor service");

  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }

  isMonitoring = false;
  logger.info("Monitor service stopped");
}

/**
 * Get monitor status
 */
export function getMonitorStatus(): {
  running: boolean;
  interval: number;
  watchlistCount: number;
} {
  return {
    running: isMonitoring,
    interval: MONITOR_INTERVAL_MS,
    watchlistCount: store.getAllWatchlists().length,
  };
}

/**
 * Manually trigger a monitor cycle (for testing)
 */
export async function triggerMonitorCycle(): Promise<void> {
  await runMonitorCycle();
}
