/**
 * Loyalty System - User Stats and Rewards
 * Wave 3 Feature: Volume-based rewards and lifetime tracking
 */

import { logger } from "../utils/logger";

// Loyalty tiers
export interface LoyaltyTier {
  name: "Bronze" | "Silver" | "Gold" | "Platinum";
  minVolume: number;
  maxVolume: number;
  freeTopups: number;
  color: string;
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  {
    name: "Bronze",
    minVolume: 0,
    maxVolume: 200,
    freeTopups: 0,
    color: "#CD7F32",
  },
  {
    name: "Silver",
    minVolume: 200,
    maxVolume: 1000,
    freeTopups: 1,
    color: "#C0C0C0",
  },
  {
    name: "Gold",
    minVolume: 1000,
    maxVolume: 5000,
    freeTopups: 2,
    color: "#FFD700",
  },
  {
    name: "Platinum",
    minVolume: 5000,
    maxVolume: Infinity,
    freeTopups: 5,
    color: "#E5E4E2",
  },
];

export interface UserStats {
  id: string;
  telegramId?: string;
  lifetimeVolumeUsd: number;
  totalShifts: number;
  totalTopUps: number;
  gasPacksDelivered: number;
  zeroGasRescues: number;
  freeTopupsAvailable: number;
  freeTopupsUsed: number;
  currentTier: string;
  streakDays: number;
  lastActiveDate: string;
  joinedAt: string;
  favoriteChain?: string;
  chainStats: Record<string, { shifts: number; volume: number }>;
}

// In-memory stats store (would be database in production)
const userStatsStore: Map<string, UserStats> = new Map();

/**
 * Get or create user stats
 */
export function getUserStats(userId: string): UserStats {
  let stats = userStatsStore.get(userId);

  if (!stats) {
    stats = {
      id: userId,
      lifetimeVolumeUsd: 0,
      totalShifts: 0,
      totalTopUps: 0,
      gasPacksDelivered: 0,
      zeroGasRescues: 0,
      freeTopupsAvailable: 0,
      freeTopupsUsed: 0,
      currentTier: "Bronze",
      streakDays: 0,
      lastActiveDate: new Date().toISOString().split("T")[0],
      joinedAt: new Date().toISOString(),
      chainStats: {},
    };
    userStatsStore.set(userId, stats);
  }

  return stats;
}

/**
 * Get current loyalty tier based on volume
 */
export function getTier(volumeUsd: number): LoyaltyTier {
  for (const tier of LOYALTY_TIERS.slice().reverse()) {
    if (volumeUsd >= tier.minVolume) {
      return tier;
    }
  }
  return LOYALTY_TIERS[0];
}

/**
 * Calculate progress to next tier
 */
export function getTierProgress(volumeUsd: number): {
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  progressPercent: number;
  volumeToNextTier: number;
} {
  const currentTier = getTier(volumeUsd);
  const currentIndex = LOYALTY_TIERS.findIndex(
    (t) => t.name === currentTier.name
  );
  const nextTier =
    currentIndex < LOYALTY_TIERS.length - 1
      ? LOYALTY_TIERS[currentIndex + 1]
      : null;

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      progressPercent: 100,
      volumeToNextTier: 0,
    };
  }

  const volumeInTier = volumeUsd - currentTier.minVolume;
  const tierRange = nextTier.minVolume - currentTier.minVolume;
  const progressPercent = Math.min(
    100,
    Math.round((volumeInTier / tierRange) * 100)
  );
  const volumeToNextTier = nextTier.minVolume - volumeUsd;

  return {
    currentTier,
    nextTier,
    progressPercent,
    volumeToNextTier: Math.max(0, volumeToNextTier),
  };
}

/**
 * Record a completed shift and update stats
 */
export function recordShift(
  userId: string,
  chain: string,
  volumeUsd: number,
  isTopUp: boolean = false,
  wasZeroGasRescue: boolean = false
): UserStats {
  const stats = getUserStats(userId);
  const previousTier = getTier(stats.lifetimeVolumeUsd);

  // Update stats
  stats.lifetimeVolumeUsd += volumeUsd;
  stats.totalShifts += 1;
  if (isTopUp) {
    stats.totalTopUps += 1;
    stats.gasPacksDelivered += 1;
  }
  if (wasZeroGasRescue) {
    stats.zeroGasRescues += 1;
  }

  // Update chain stats
  if (!stats.chainStats[chain]) {
    stats.chainStats[chain] = { shifts: 0, volume: 0 };
  }
  stats.chainStats[chain].shifts += 1;
  stats.chainStats[chain].volume += volumeUsd;

  // Calculate favorite chain
  let maxShifts = 0;
  let favChain = "";
  for (const [c, data] of Object.entries(stats.chainStats)) {
    if (data.shifts > maxShifts) {
      maxShifts = data.shifts;
      favChain = c;
    }
  }
  stats.favoriteChain = favChain;

  // Check for tier upgrade
  const newTier = getTier(stats.lifetimeVolumeUsd);
  if (newTier.name !== previousTier.name) {
    stats.currentTier = newTier.name;
    // Award free topups on tier upgrade
    const newFreeTopups = newTier.freeTopups - previousTier.freeTopups;
    if (newFreeTopups > 0) {
      stats.freeTopupsAvailable += newFreeTopups;
      logger.info(
        {
          userId,
          newTier: newTier.name,
          freeTopupsAwarded: newFreeTopups,
        },
        "User upgraded to new tier"
      );
    }
  }

  // Update streak
  const today = new Date().toISOString().split("T")[0];
  const lastActive = stats.lastActiveDate;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (lastActive === yesterday) {
    stats.streakDays += 1;
  } else if (lastActive !== today) {
    stats.streakDays = 1;
  }
  stats.lastActiveDate = today;

  userStatsStore.set(userId, stats);
  return stats;
}

/**
 * Use a free topup credit
 */
export function useFreeTopup(userId: string): boolean {
  const stats = getUserStats(userId);

  if (stats.freeTopupsAvailable <= 0) {
    return false;
  }

  stats.freeTopupsAvailable -= 1;
  stats.freeTopupsUsed += 1;
  userStatsStore.set(userId, stats);

  logger.info(
    {
      userId,
      freeTopupsRemaining: stats.freeTopupsAvailable,
    },
    "Free topup used"
  );

  return true;
}

/**
 * Get leaderboard (top users by volume)
 */
export function getLeaderboard(limit: number = 10): UserStats[] {
  const allStats = Array.from(userStatsStore.values());
  return allStats
    .sort((a, b) => b.lifetimeVolumeUsd - a.lifetimeVolumeUsd)
    .slice(0, limit);
}

/**
 * Get global platform stats
 */
export function getPlatformStats(): {
  totalUsers: number;
  totalVolume: number;
  totalShifts: number;
  totalTopUps: number;
  gasPacksDelivered: number;
  zeroGasRescues: number;
  avgVolumePerUser: number;
} {
  const allStats = Array.from(userStatsStore.values());

  const totalVolume = allStats.reduce((sum, s) => sum + s.lifetimeVolumeUsd, 0);
  const totalShifts = allStats.reduce((sum, s) => sum + s.totalShifts, 0);
  const totalTopUps = allStats.reduce((sum, s) => sum + s.totalTopUps, 0);
  const gasPacksDelivered = allStats.reduce(
    (sum, s) => sum + s.gasPacksDelivered,
    0
  );
  const zeroGasRescues = allStats.reduce((sum, s) => sum + s.zeroGasRescues, 0);

  return {
    totalUsers: allStats.length,
    totalVolume: Math.round(totalVolume * 100) / 100,
    totalShifts,
    totalTopUps,
    gasPacksDelivered,
    zeroGasRescues,
    avgVolumePerUser:
      allStats.length > 0
        ? Math.round((totalVolume / allStats.length) * 100) / 100
        : 0,
  };
}

/**
 * Manually add free topups (for promotions, etc.)
 */
export function addFreeTopups(
  userId: string,
  count: number,
  reason: string
): UserStats {
  const stats = getUserStats(userId);
  stats.freeTopupsAvailable += count;
  userStatsStore.set(userId, stats);

  logger.info(
    {
      userId,
      count,
      reason,
      newTotal: stats.freeTopupsAvailable,
    },
    "Free topups added"
  );

  return stats;
}

export default {
  getUserStats,
  getTier,
  getTierProgress,
  recordShift,
  useFreeTopup,
  getLeaderboard,
  getPlatformStats,
  addFreeTopups,
  LOYALTY_TIERS,
};
