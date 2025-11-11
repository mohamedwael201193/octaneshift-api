/**
 * Bot UI Helpers - Pagination and Coin Selection
 * Phase E: Dynamic coin keyboards with search and pagination
 */

import * as coinsCache from "../lib/coinsCache";

export interface CoinOption {
  coin: string;
  network: string;
  display: string;
  minAmount?: number;
  requiresMemo?: boolean;
}

export interface PaginationState {
  items: CoinOption[];
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Convert cache coins to bot-friendly options
 */
export function getPopularCoinOptions(): CoinOption[] {
  const popular = coinsCache.getPopularCoins();
  const options: CoinOption[] = [];

  for (const coin of popular) {
    const networks = coin.networks;

    // For popular coins, show primary networks
    for (const network of networks.slice(0, 2)) {
      // Top 2 networks per coin
      const requiresMemo = coinsCache.requiresMemo(coin.coin, network);
      options.push({
        coin: coin.coin,
        network: network,
        display: `${coin.coin.toUpperCase()} · ${network}${
          requiresMemo ? " 🏷️" : ""
        }`,
        requiresMemo,
      });
    }
  }

  return options;
}

/**
 * Get all available coin options (for "Browse All" flow)
 */
export function getAllCoinOptions(): CoinOption[] {
  const allCoins = coinsCache.getAllCoins();
  const options: CoinOption[] = [];

  for (const coin of allCoins) {
    const networks = coin.networks;

    for (const network of networks) {
      const requiresMemo = coinsCache.requiresMemo(coin.coin, network);
      options.push({
        coin: coin.coin,
        network: network,
        display: `${coin.coin.toUpperCase()} · ${network}${
          requiresMemo ? " 🏷️" : ""
        }`,
        requiresMemo,
      });
    }
  }

  return options;
}

/**
 * Search coins by symbol or name
 */
export function searchCoinOptions(query: string): CoinOption[] {
  const searchResults = coinsCache.searchCoins(query);
  const options: CoinOption[] = [];

  for (const coin of searchResults) {
    const networks = coin.networks;

    for (const network of networks) {
      const requiresMemo = coinsCache.requiresMemo(coin.coin, network);
      options.push({
        coin: coin.coin,
        network: network,
        display: `${coin.coin.toUpperCase()} · ${network}${
          requiresMemo ? " 🏷️" : ""
        }`,
        requiresMemo,
      });
    }
  }

  return options;
}

/**
 * Paginate items for bot keyboards
 */
export function paginate(
  items: CoinOption[],
  page: number = 0,
  pageSize: number = 6
): PaginationState {
  const totalPages = Math.ceil(items.length / pageSize);
  const start = page * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);

  return {
    items: paginatedItems,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Build inline keyboard with pagination
 */
export function buildPaginatedKeyboard(
  pagination: PaginationState,
  callbackPrefix: string,
  context?: string
) {
  const keyboard = pagination.items.map((item) => [
    {
      text: item.display,
      callback_data: `${callbackPrefix}:${item.coin}:${item.network}${
        context ? `:${context}` : ""
      }`,
    },
  ]);

  // Navigation row
  const navRow = [];
  if (pagination.page > 0) {
    navRow.push({
      text: "⬅️ Previous",
      callback_data: `page:${callbackPrefix}:${pagination.page - 1}${
        context ? `:${context}` : ""
      }`,
    });
  }

  // Page indicator
  if (pagination.totalPages > 1) {
    navRow.push({
      text: `📄 ${pagination.page + 1}/${pagination.totalPages}`,
      callback_data: "noop", // No action
    });
  }

  if (pagination.page < pagination.totalPages - 1) {
    navRow.push({
      text: "Next ➡️",
      callback_data: `page:${callbackPrefix}:${pagination.page + 1}${
        context ? `:${context}` : ""
      }`,
    });
  }

  if (navRow.length > 0) {
    keyboard.push(navRow);
  }

  // Additional options row
  const optionsRow = [];
  optionsRow.push({
    text: "🔍 Search",
    callback_data: `search:${callbackPrefix}${context ? `:${context}` : ""}`,
  });
  optionsRow.push({
    text: "🔙 Cancel",
    callback_data: "cancel",
  });

  keyboard.push(optionsRow);

  return { inline_keyboard: keyboard };
}

/**
 * Build simple keyboard for popular coins (no pagination needed)
 */
export function buildPopularCoinsKeyboard(
  callbackPrefix: string,
  context?: string
) {
  const popular = getPopularCoinOptions();
  const keyboard = popular.slice(0, 8).map((item) => [
    {
      text: item.display,
      callback_data: `${callbackPrefix}:${item.coin}:${item.network}${
        context ? `:${context}` : ""
      }`,
    },
  ]);

  // Add "Browse All" and "Search" options
  keyboard.push([
    {
      text: "📋 Browse All Coins",
      callback_data: `browse:${callbackPrefix}${context ? `:${context}` : ""}`,
    },
  ]);

  keyboard.push([
    {
      text: "🔍 Search",
      callback_data: `search:${callbackPrefix}${context ? `:${context}` : ""}`,
    },
    {
      text: "🔙 Cancel",
      callback_data: "cancel",
    },
  ]);

  return { inline_keyboard: keyboard };
}

/**
 * Get coin display name with network
 */
export function getCoinDisplayName(coin: string, network: string): string {
  const coinData = coinsCache.getCoin(coin);
  if (!coinData) return `${coin.toUpperCase()} · ${network}`;

  const requiresMemo = coinsCache.requiresMemo(coin, network);

  return `${coinData.coin.toUpperCase()} · ${network}${
    requiresMemo ? " 🏷️" : ""
  }`;
}

/**
 * Format quote expiry countdown
 */
export function formatExpiryCountdown(expiresAt: string): string {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const remaining = expiry - now;

  if (remaining <= 0) return "⏰ Expired";

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (minutes > 0) {
    return `⏳ ${minutes}m ${seconds}s remaining`;
  }
  return `⏳ ${seconds}s remaining`;
}

/**
 * Check if quote is expiring soon (< 60 seconds)
 */
export function isExpiringSoon(expiresAt: string): boolean {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const remaining = expiry - now;
  return remaining > 0 && remaining < 60000;
}
