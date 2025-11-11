/**
 * Pairs Engine - Smart deposit recommendations and pair analysis
 * Wraps SideShift /v2/pair and /v2/pairs APIs with intelligent ranking
 */

import logger from "../utils/logger";
import * as coinsCache from "./coinsCache";

const SIDESHIFT_API_BASE = "https://sideshift.ai/api/v2";
const SIDESHIFT_SECRET = process.env.SIDESHIFT_SECRET || "";
const AFFILIATE_ID = process.env.AFFILIATE_ID || "";

export interface PairInfo {
  depositCoin: string;
  settleCoin: string;
  depositNetwork: string;
  settleNetwork: string;
  min: string;
  max: string;
  rate: string;
}

export interface DepositRecommendation {
  depositCoin: string;
  depositNetwork: string;
  min: string;
  max: string;
  rate: string;
  effectiveCost: number; // Lower is better
  reason: string;
  displayName: string;
}

/**
 * Get pair information from SideShift
 */
export async function getPair(
  fromCoin: string,
  fromNetwork: string,
  toCoin: string,
  toNetwork: string,
  amount?: number,
  commissionRate?: string
): Promise<PairInfo> {
  try {
    // Construct coin-network identifiers
    const from = fromNetwork
      ? `${fromCoin.toLowerCase()}-${fromNetwork.toLowerCase()}`
      : fromCoin.toLowerCase();
    const to = toNetwork
      ? `${toCoin.toLowerCase()}-${toNetwork.toLowerCase()}`
      : toCoin.toLowerCase();

    const url = new URL(`${SIDESHIFT_API_BASE}/pair/${from}/${to}`);
    url.searchParams.append("affiliateId", AFFILIATE_ID);

    if (amount) {
      url.searchParams.append("amount", amount.toString());
    }

    if (commissionRate) {
      url.searchParams.append("commissionRate", commissionRate);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "x-sideshift-secret": SIDESHIFT_SECRET,
      },
    });

    if (!response.ok) {
      throw new Error(
        `SideShift pair API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as PairInfo;
    return data;
  } catch (error) {
    logger.error("Failed to get pair info from SideShift", {
      error,
      fromCoin,
      fromNetwork,
      toCoin,
      toNetwork,
    });
    throw error;
  }
}

/**
 * Get multiple pairs in bulk
 */
export async function getPairs(
  pairs: Array<{
    from: string;
    fromNetwork?: string;
    to: string;
    toNetwork?: string;
  }>,
  commissionRate?: string
): Promise<PairInfo[]> {
  try {
    // Format pairs string: "btc-mainnet,usdc-bsc,bch,eth"
    const pairsString = pairs
      .map((p) => {
        const from = p.fromNetwork
          ? `${p.from.toLowerCase()}-${p.fromNetwork.toLowerCase()}`
          : p.from.toLowerCase();
        const to = p.toNetwork
          ? `${p.to.toLowerCase()}-${p.toNetwork.toLowerCase()}`
          : p.to.toLowerCase();
        return `${from},${to}`;
      })
      .join(",");

    const url = new URL(`${SIDESHIFT_API_BASE}/pairs`);
    url.searchParams.append("pairs", pairsString);
    url.searchParams.append("affiliateId", AFFILIATE_ID);

    if (commissionRate) {
      url.searchParams.append("commissionRate", commissionRate);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "x-sideshift-secret": SIDESHIFT_SECRET,
      },
    });

    if (!response.ok) {
      throw new Error(
        `SideShift pairs API returned ${response.status}: ${response.statusText}`
      );
    }

    const data = (await response.json()) as PairInfo[];
    return data;
  } catch (error) {
    logger.error("Failed to get pairs info from SideShift", { error });
    throw error;
  }
}

/**
 * Find best deposit options for a settle target
 * Ranks by effective cost (considering rate, fees, and liquidity)
 */
export async function bestDepositsFor(options: {
  settleCoin: string;
  settleNetwork: string;
  settleAmount: number;
  limit?: number;
}): Promise<DepositRecommendation[]> {
  const { settleCoin, settleNetwork, settleAmount, limit = 3 } = options;

  try {
    // Get popular/liquid deposit coins to evaluate
    const popularCoins = coinsCache.getPopularCoins();
    const additionalCoins = ["DAI", "BUSD", "XRP", "ADA", "DOT", "AVAX", "TRX"];

    // Build list of deposit options to test
    const depositOptions: Array<{ coin: string; network: string }> = [];

    for (const coin of popularCoins) {
      for (const network of coin.networks) {
        // Skip deprecated or offline networks
        if (coin.deprecated) continue;
        if (
          Array.isArray(coin.depositOffline) &&
          coin.depositOffline.includes(network)
        )
          continue;
        if (
          Array.isArray(coin.settleOffline) &&
          coin.settleOffline.includes(network)
        )
          continue;

        depositOptions.push({ coin: coin.coin, network });
      }
    }

    // Add additional coins if not already included
    for (const coinSymbol of additionalCoins) {
      const coin = coinsCache.getCoin(coinSymbol);
      if (coin && !coin.deprecated) {
        for (const network of coin.networks) {
          if (
            Array.isArray(coin.depositOffline) &&
            coin.depositOffline.includes(network)
          )
            continue;
          if (
            Array.isArray(coin.settleOffline) &&
            coin.settleOffline.includes(network)
          )
            continue;

          if (
            !depositOptions.find(
              (d) => d.coin === coin.coin && d.network === network
            )
          ) {
            depositOptions.push({ coin: coin.coin, network });
          }
        }
      }
    }

    logger.info(
      `Evaluating ${depositOptions.length} deposit options for ${settleCoin}-${settleNetwork}`
    );

    // Fetch pair info for all options (in batches to avoid rate limits)
    const BATCH_SIZE = 10;
    const recommendations: DepositRecommendation[] = [];

    for (let i = 0; i < depositOptions.length; i += BATCH_SIZE) {
      const batch = depositOptions.slice(i, i + BATCH_SIZE);

      // Fetch pairs sequentially with delay to respect rate limits
      for (const option of batch) {
        try {
          const pairInfo = await getPair(
            option.coin,
            option.network,
            settleCoin,
            settleNetwork,
            settleAmount
          );

          // Calculate effective cost (lower is better)
          // Consider: rate, min deposit padding, network fee implications
          const rate = parseFloat(pairInfo.rate);
          const min = parseFloat(pairInfo.min);

          // Effective cost = (1/rate) + penalty for high minimums
          const minPaddingPenalty = min > 10 ? min * 0.1 : 0;
          const effectiveCost = 1 / rate + minPaddingPenalty;

          // Determine recommendation reason
          let reason = "Good rate and liquidity";
          if (min < 1) {
            reason = "Low minimum deposit, great for small amounts";
          } else if (min > 100) {
            reason = "High minimum deposit, best for large amounts";
          }

          if (rate > 1.0) {
            reason = "Excellent rate: receive more than you send!";
          }

          recommendations.push({
            depositCoin: option.coin,
            depositNetwork: option.network,
            min: pairInfo.min,
            max: pairInfo.max,
            rate: pairInfo.rate,
            effectiveCost,
            reason,
            displayName: coinsCache.getDisplayName(option.coin, option.network),
          });

          // Small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          // Skip pairs that fail (might not be supported)
          logger.debug(
            `Pair ${option.coin}-${option.network} to ${settleCoin}-${settleNetwork} not available`
          );
        }
      }
    }

    // Sort by effective cost (lower is better)
    recommendations.sort((a, b) => a.effectiveCost - b.effectiveCost);

    // Return top N recommendations
    return recommendations.slice(0, limit);
  } catch (error) {
    logger.error("Failed to calculate best deposits", { error, options });
    throw error;
  }
}

/**
 * Get estimated network fee for a pair
 */
export async function getNetworkFee(
  _fromCoin: string,
  _fromNetwork: string,
  _toCoin: string,
  _toNetwork: string
): Promise<{ settleCoinNetworkFee?: string; networkFeeUsd?: string }> {
  try {
    // For variable shifts, we can get fee estimates
    // This would require creating a temporary variable shift or using the pairs API
    // For now, return empty - this can be enhanced later
    return {};
  } catch (error) {
    logger.error("Failed to get network fee", { error });
    return {};
  }
}
