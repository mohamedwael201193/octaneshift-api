/**
 * Gas Oracle Service
 * Fetches real-time gas prices and computes smart presets
 * Wave 3 Feature: Live Gas Intelligence
 */

import { logger } from "../utils/logger";

// Chain RPC endpoints for gas price fetching
const CHAIN_RPCS: Record<string, string> = {
  eth: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  arb: "https://arb1.arbitrum.io/rpc",
  op: "https://mainnet.optimism.io",
  pol: "https://polygon-rpc.com",
  avax: "https://api.avax.network/ext/bc/C/rpc",
};

// Average gas limits for common operations
const AVG_GAS_LIMITS: Record<string, number> = {
  eth: 21000, // Simple ETH transfer
  base: 21000,
  arb: 21000,
  op: 21000,
  pol: 21000,
  avax: 21000,
};

// Gas multipliers for different transaction types
const TX_MULTIPLIERS = {
  simple: 1,
  swap: 3, // DEX swap ~65k gas
  mint: 5, // NFT mint ~100k gas
  defi: 4, // DeFi interaction ~80k gas
};

interface GasPrice {
  chain: string;
  gasPriceGwei: number;
  baseFeeGwei?: number;
  priorityFeeGwei?: number;
  costPerTxNative: number;
  costPerTxUsd: number;
  lastUpdated: string;
}

interface SmartPreset {
  label: string;
  txCount: number;
  amountNative: number;
  amountUsd: number;
  description: string;
}

// Cache for gas prices
const gasCache: Record<string, GasPrice> = {};
const CACHE_TTL_MS = 30000; // 30 seconds

// Native token prices in USD (updated periodically via CoinGecko)
let nativePrices: Record<string, number> = {
  eth: 2200,
  pol: 0.5,
  avax: 35,
};
let pricesLastUpdated = 0;
const PRICES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// CoinGecko IDs for native tokens
const COINGECKO_IDS: Record<string, string> = {
  eth: "ethereum",
  pol: "matic-network",
  avax: "avalanche-2",
};

/**
 * Fetch native token prices from CoinGecko
 */
async function fetchNativePrices(): Promise<void> {
  // Check if cache is still valid
  if (Date.now() - pricesLastUpdated < PRICES_CACHE_TTL_MS) {
    return;
  }

  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, { usd: number }>;

    // Map CoinGecko IDs back to our chain keys
    for (const [chainKey, geckoId] of Object.entries(COINGECKO_IDS)) {
      if (data[geckoId]?.usd) {
        nativePrices[chainKey] = data[geckoId].usd;
      }
    }

    pricesLastUpdated = Date.now();
    logger.info(
      { prices: nativePrices },
      "Updated native token prices from CoinGecko"
    );
  } catch (error) {
    logger.warn(
      { error },
      "Failed to fetch prices from CoinGecko, using cached values"
    );
    // Keep using existing cached prices
  }
}

/**
 * Get current native prices (refreshes from CoinGecko if needed)
 */
export async function getNativePrices(): Promise<Record<string, number>> {
  await fetchNativePrices();
  return { ...nativePrices };
}

/**
 * Fetch gas price from RPC
 */
async function fetchGasPrice(chain: string): Promise<number> {
  const rpc = CHAIN_RPCS[chain];
  if (!rpc) {
    throw new Error(`Unknown chain: ${chain}`);
  }

  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      }),
    });

    const data = (await response.json()) as { result: string };
    const gasPriceWei = parseInt(data.result, 16);
    const gasPriceGwei = gasPriceWei / 1e9;

    return gasPriceGwei;
  } catch (error) {
    logger.error({ chain, error }, "Failed to fetch gas price");
    // Return fallback values
    const fallbacks: Record<string, number> = {
      eth: 20,
      base: 0.01,
      arb: 0.1,
      op: 0.01,
      pol: 30,
      avax: 25,
    };
    return fallbacks[chain] || 20;
  }
}

/**
 * Get native token symbol for chain
 */
function getNativeSymbol(chain: string): string {
  const symbols: Record<string, string> = {
    eth: "ETH",
    base: "ETH",
    arb: "ETH",
    op: "ETH",
    pol: "POL",
    avax: "AVAX",
  };
  return symbols[chain] || "ETH";
}

/**
 * Get native token price key
 */
function getNativePriceKey(chain: string): string {
  const keys: Record<string, string> = {
    eth: "eth",
    base: "eth",
    arb: "eth",
    op: "eth",
    pol: "pol",
    avax: "avax",
  };
  return keys[chain] || "eth";
}

/**
 * Get current gas price for a chain (with caching)
 */
export async function getGasPrice(chain: string): Promise<GasPrice> {
  const cached = gasCache[chain];
  if (
    cached &&
    Date.now() - new Date(cached.lastUpdated).getTime() < CACHE_TTL_MS
  ) {
    return cached;
  }

  // Refresh native prices
  await fetchNativePrices();

  const gasPriceGwei = await fetchGasPrice(chain);
  const gasLimit = AVG_GAS_LIMITS[chain] || 21000;
  const costPerTxNative = (gasPriceGwei * gasLimit) / 1e9;

  const priceKey = getNativePriceKey(chain);
  const nativeUsdPrice = nativePrices[priceKey] || 2000;
  const costPerTxUsd = costPerTxNative * nativeUsdPrice;

  const gasPrice: GasPrice = {
    chain,
    gasPriceGwei,
    costPerTxNative,
    costPerTxUsd,
    lastUpdated: new Date().toISOString(),
  };

  gasCache[chain] = gasPrice;
  return gasPrice;
}

/**
 * Get all gas prices for supported chains
 */
export async function getAllGasPrices(): Promise<Record<string, GasPrice>> {
  const chains = Object.keys(CHAIN_RPCS);
  const prices: Record<string, GasPrice> = {};

  await Promise.all(
    chains.map(async (chain) => {
      try {
        prices[chain] = await getGasPrice(chain);
      } catch (error) {
        logger.error({ chain, error }, "Failed to get gas price");
      }
    })
  );

  return prices;
}

/**
 * Calculate smart presets based on current gas prices
 */
export async function getSmartPresets(chain: string): Promise<SmartPreset[]> {
  const gasPrice = await getGasPrice(chain);

  // Base cost per simple transaction
  const baseCost = gasPrice.costPerTxNative;

  const presets: SmartPreset[] = [
    {
      label: "+1 tx",
      txCount: 1,
      amountNative: Math.ceil(baseCost * 1.5 * 10000) / 10000, // 50% buffer
      amountUsd: Math.ceil(gasPrice.costPerTxUsd * 1.5 * 100) / 100,
      description: `Enough for 1 transaction at ${gasPrice.gasPriceGwei.toFixed(
        2
      )} gwei`,
    },
    {
      label: "+5 tx",
      txCount: 5,
      amountNative: Math.ceil(baseCost * 5 * 1.3 * 10000) / 10000, // 30% buffer
      amountUsd: Math.ceil(gasPrice.costPerTxUsd * 5 * 1.3 * 100) / 100,
      description: `Enough for ~5 transactions`,
    },
    {
      label: "+1 day",
      txCount: 25,
      amountNative: Math.ceil(baseCost * 25 * 1.2 * 10000) / 10000, // 20% buffer
      amountUsd: Math.ceil(gasPrice.costPerTxUsd * 25 * 1.2 * 100) / 100,
      description: `Typical daily usage (~25 tx)`,
    },
    {
      label: "Mint NFT",
      txCount: 5,
      amountNative:
        Math.ceil(baseCost * TX_MULTIPLIERS.mint * 1.5 * 10000) / 10000,
      amountUsd:
        Math.ceil(gasPrice.costPerTxUsd * TX_MULTIPLIERS.mint * 1.5 * 100) /
        100,
      description: `NFT minting (~100k gas)`,
    },
    {
      label: "DeFi Pack",
      txCount: 10,
      amountNative:
        Math.ceil(baseCost * TX_MULTIPLIERS.defi * 10 * 1.2 * 10000) / 10000,
      amountUsd:
        Math.ceil(
          gasPrice.costPerTxUsd * TX_MULTIPLIERS.defi * 10 * 1.2 * 100
        ) / 100,
      description: `10 DeFi interactions`,
    },
  ];

  return presets;
}

/**
 * Calculate OctaneScore (gas health) for a wallet
 * Returns how many transactions the current balance can cover
 */
export async function calculateOctaneScore(
  chain: string,
  balanceNative: number
): Promise<{
  score: number;
  txRemaining: number;
  status: "healthy" | "low" | "critical";
  message: string;
}> {
  const gasPrice = await getGasPrice(chain);
  const txRemaining = Math.floor(balanceNative / gasPrice.costPerTxNative);

  let status: "healthy" | "low" | "critical";
  let message: string;

  if (txRemaining >= 20) {
    status = "healthy";
    message = `You have ~${txRemaining} tx worth of gas. Looking good! ✅`;
  } else if (txRemaining >= 5) {
    status = "low";
    message = `You have ~${txRemaining} tx worth of gas. Consider topping up soon. ⚠️`;
  } else {
    status = "critical";
    message = `Only ~${txRemaining} tx remaining! Top up now to avoid getting stuck. 🚨`;
  }

  return {
    score: Math.min(100, txRemaining * 5), // 0-100 score
    txRemaining,
    status,
    message,
  };
}

/**
 * Suggest optimal gas amount based on intended usage
 */
export async function suggestGasAmount(
  chain: string,
  usage: "light" | "medium" | "heavy" | "mint" | "defi"
): Promise<{
  amountNative: number;
  amountUsd: number;
  txCovered: number;
  description: string;
}> {
  const gasPrice = await getGasPrice(chain);
  const baseCost = gasPrice.costPerTxNative;

  const usageMultipliers: Record<
    string,
    { tx: number; gasMultiplier: number }
  > = {
    light: { tx: 10, gasMultiplier: 1 },
    medium: { tx: 25, gasMultiplier: 1.5 },
    heavy: { tx: 50, gasMultiplier: 2 },
    mint: { tx: 5, gasMultiplier: TX_MULTIPLIERS.mint },
    defi: { tx: 20, gasMultiplier: TX_MULTIPLIERS.defi },
  };

  const { tx, gasMultiplier } =
    usageMultipliers[usage] || usageMultipliers.medium;
  const amountNative =
    Math.ceil(baseCost * tx * gasMultiplier * 1.2 * 10000) / 10000;
  const amountUsd =
    Math.ceil(gasPrice.costPerTxUsd * tx * gasMultiplier * 1.2 * 100) / 100;

  return {
    amountNative,
    amountUsd,
    txCovered: tx,
    description: `Covers ~${tx} ${usage} transactions with 20% buffer`,
  };
}

/**
 * Update native token prices (call periodically)
 */
export function updateNativePrices(prices: Record<string, number>): void {
  nativePrices = { ...nativePrices, ...prices };
  logger.info({ prices: nativePrices }, "Updated native token prices");
}

/**
 * Get recommended gas-on-arrival amount for a destination chain
 */
export async function getGasOnArrivalRecommendation(
  destChain: string
): Promise<{
  recommended: number;
  symbol: string;
  usdValue: number;
  reason: string;
}> {
  const gasPrice = await getGasPrice(destChain);
  const symbol = getNativeSymbol(destChain);

  // Recommend enough for 5 transactions
  const recommended =
    Math.ceil(gasPrice.costPerTxNative * 5 * 1.3 * 10000) / 10000;
  const usdValue = Math.ceil(gasPrice.costPerTxUsd * 5 * 1.3 * 100) / 100;

  return {
    recommended,
    symbol,
    usdValue,
    reason: `Enough for ~5 transactions on ${destChain.toUpperCase()} at current gas prices`,
  };
}

export default {
  getGasPrice,
  getAllGasPrices,
  getGasPrices: getAllGasPrices, // Alias for backwards compatibility
  getSmartPresets,
  calculateOctaneScore,
  suggestGasAmount,
  updateNativePrices,
  getGasOnArrivalRecommendation,
};

// Named export alias
export { getAllGasPrices as getGasPrices };
