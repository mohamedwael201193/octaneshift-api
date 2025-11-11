/**
 * Dynamic coins/networks discovery cache
 * Fetches and caches SideShift coin data to eliminate hardcoded lists
 */

import logger from "../utils/logger";

export interface CoinNetwork {
  network: string;
  contractAddress?: string;
  decimals?: number;
}

export interface CoinData {
  coin: string; // e.g., "BTC", "ETH", "USDT"
  name: string; // e.g., "Bitcoin", "Ethereum", "Tether"
  networks: string[]; // e.g., ["bitcoin"], ["ethereum", "arbitrum", "optimism"]
  networksWithMemo: string[]; // Networks requiring memo/tag (e.g., XRP, XLM, EOS)
  hasMemo: boolean;
  fixedOnly: boolean | string[];
  variableOnly: boolean | string[];
  depositOffline: boolean | string[];
  settleOffline: boolean | string[];
  tokenDetails?: {
    [network: string]: {
      contractAddress: string;
      decimals: number;
    };
  };
  deprecated?: boolean;
}

interface CoinsCacheState {
  coins: CoinData[];
  lastFetch: number;
  isInitialized: boolean;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const SIDESHIFT_API_BASE = "https://sideshift.ai/api/v2";

const state: CoinsCacheState = {
  coins: [],
  lastFetch: 0,
  isInitialized: false,
};

/**
 * Fetch coins from SideShift API
 */
async function fetchCoins(): Promise<CoinData[]> {
  try {
    const response = await fetch(`${SIDESHIFT_API_BASE}/coins`);

    if (!response.ok) {
      throw new Error(
        `SideShift API returned ${response.status}: ${response.statusText}`
      );
    }

    const coins = (await response.json()) as CoinData[];
    logger.info(`Fetched ${coins.length} coins from SideShift API`);

    return coins;
  } catch (error) {
    logger.error("Failed to fetch coins from SideShift", { error });
    throw error;
  }
}

/**
 * Initialize the cache and start periodic refresh
 */
export async function initializeCoinsCache(): Promise<void> {
  try {
    logger.info("Initializing coins cache...");
    const coins = await fetchCoins();

    state.coins = coins;
    state.lastFetch = Date.now();
    state.isInitialized = true;

    logger.info(`Coins cache initialized with ${coins.length} coins`);

    // Start periodic refresh
    setInterval(async () => {
      try {
        logger.info("Refreshing coins cache...");
        const freshCoins = await fetchCoins();
        state.coins = freshCoins;
        state.lastFetch = Date.now();
        logger.info("Coins cache refreshed successfully");
      } catch (error) {
        logger.error("Failed to refresh coins cache", { error });
        // Keep using stale cache on refresh failure
      }
    }, CACHE_DURATION);
  } catch (error) {
    logger.error("Failed to initialize coins cache", { error });
    throw error;
  }
}

/**
 * Get all coins
 */
export function getAllCoins(): CoinData[] {
  if (!state.isInitialized) {
    throw new Error(
      "Coins cache not initialized. Call initializeCoinsCache() first."
    );
  }
  return state.coins.filter((coin) => !coin.deprecated);
}

/**
 * Get a specific coin by coin ID
 */
export function getCoin(coinId: string): CoinData | undefined {
  if (!state.isInitialized) {
    throw new Error(
      "Coins cache not initialized. Call initializeCoinsCache() first."
    );
  }

  const normalizedId = coinId.toUpperCase();
  return state.coins.find((coin) => coin.coin.toUpperCase() === normalizedId);
}

/**
 * Get all networks for a coin
 */
export function getNetworks(coinId: string): string[] {
  const coin = getCoin(coinId);
  return coin?.networks ?? [];
}

/**
 * Check if a coin/network combination requires memo/tag
 */
export function requiresMemo(coinId: string, network: string): boolean {
  const coin = getCoin(coinId);
  if (!coin) return false;

  return coin.networksWithMemo.includes(network);
}

/**
 * Get display name for a coin/network combination
 */
export function getDisplayName(coinId: string, network?: string): string {
  const coin = getCoin(coinId);
  if (!coin) return coinId;

  if (!network || coin.networks.length === 1) {
    return `${coin.name} (${coin.coin})`;
  }

  // Multi-network asset, show network
  const networkDisplay = network.charAt(0).toUpperCase() + network.slice(1);
  return `${coin.name} (${coin.coin} - ${networkDisplay})`;
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats() {
  return {
    totalCoins: state.coins.length,
    activeCoins: state.coins.filter((c) => !c.deprecated).length,
    lastFetch: state.lastFetch,
    isInitialized: state.isInitialized,
    age: Date.now() - state.lastFetch,
    isStale: Date.now() - state.lastFetch > CACHE_DURATION,
  };
}

/**
 * Get coins filtered by various criteria
 */
export function getCoinsFiltered(options: {
  supportsFixed?: boolean;
  supportsVariable?: boolean;
  network?: string;
  hasMultipleNetworks?: boolean;
}): CoinData[] {
  let filtered = getAllCoins();

  if (options.supportsFixed) {
    filtered = filtered.filter(
      (coin) => coin.fixedOnly === true || Array.isArray(coin.fixedOnly)
    );
  }

  if (options.supportsVariable) {
    filtered = filtered.filter(
      (coin) => coin.variableOnly === true || Array.isArray(coin.variableOnly)
    );
  }

  if (options.network) {
    filtered = filtered.filter((coin) =>
      coin.networks.includes(options.network!)
    );
  }

  if (options.hasMultipleNetworks !== undefined) {
    filtered = filtered.filter((coin) =>
      options.hasMultipleNetworks
        ? coin.networks.length > 1
        : coin.networks.length === 1
    );
  }

  return filtered;
}

/**
 * Search coins by name or symbol
 */
export function searchCoins(query: string): CoinData[] {
  if (!query || query.length < 1) {
    return getAllCoins();
  }

  const normalizedQuery = query.toLowerCase();
  return getAllCoins().filter(
    (coin) =>
      coin.coin.toLowerCase().includes(normalizedQuery) ||
      coin.name.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Get popular coins (commonly used for deposits)
 */
export function getPopularCoins(): CoinData[] {
  const popularSymbols = [
    "BTC",
    "ETH",
    "USDT",
    "USDC",
    "BNB",
    "SOL",
    "POL",
    "DOGE",
    "LTC",
    "XRP",
  ];

  return popularSymbols
    .map((symbol) => getCoin(symbol))
    .filter((coin): coin is CoinData => coin !== undefined);
}
