/**
 * Loyalty Dashboard Component
 * Wave 3 Feature: User stats and rewards display
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FaBolt,
  FaCrown,
  FaFire,
  FaGift,
  FaMedal,
  FaRocket,
  FaTrophy,
} from "react-icons/fa";
import octaneAPI from "../services/api";

interface LoyaltyTier {
  name: string;
  minVolume: number;
  maxVolume: number | null;
  freeTopups: number;
  color: string;
}

interface UserStats {
  id: string;
  lifetimeVolumeUsd: number;
  totalShifts: number;
  totalTopUps: number;
  gasPacksDelivered: number;
  zeroGasRescues: number;
  freeTopupsAvailable: number;
  freeTopupsUsed: number;
  currentTier: string;
  streakDays: number;
  favoriteChain?: string;
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  progressToNextTier: number;
  volumeToNextTier: number;
}

const tierIcons: Record<string, typeof FaMedal> = {
  Bronze: FaMedal,
  Silver: FaTrophy,
  Gold: FaCrown,
  Platinum: FaRocket,
};

interface LoyaltyDashboardProps {
  userId?: string;
  compact?: boolean;
}

export default function LoyaltyDashboard({
  userId = "demo-user",
  compact = false,
}: LoyaltyDashboardProps) {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ["loyalty-stats", userId],
    queryFn: async () => {
      const response = await octaneAPI.getLoyaltyStats(userId);
      return response.data as UserStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-800/50 rounded-2xl p-6">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  // Default mock data if API not available
  const stats: UserStats = statsData || {
    id: userId,
    lifetimeVolumeUsd: 750,
    totalShifts: 23,
    totalTopUps: 18,
    gasPacksDelivered: 18,
    zeroGasRescues: 3,
    freeTopupsAvailable: 1,
    freeTopupsUsed: 0,
    currentTier: "Silver",
    streakDays: 5,
    favoriteChain: "base",
    tier: {
      name: "Silver",
      minVolume: 200,
      maxVolume: 1000,
      freeTopups: 1,
      color: "#C0C0C0",
    },
    nextTier: {
      name: "Gold",
      minVolume: 1000,
      maxVolume: 5000,
      freeTopups: 2,
      color: "#FFD700",
    },
    progressToNextTier: 68,
    volumeToNextTier: 250,
  };

  const TierIcon = tierIcons[stats.currentTier] || FaMedal;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4"
      >
        <div
          className="p-3 rounded-full"
          style={{ backgroundColor: `${stats.tier.color}20` }}
        >
          <TierIcon className="text-2xl" style={{ color: stats.tier.color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: stats.tier.color }}>
              {stats.currentTier}
            </span>
            {stats.freeTopupsAvailable > 0 && (
              <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">
                {stats.freeTopupsAvailable} free top-up
                {stats.freeTopupsAvailable > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">
            ${stats.lifetimeVolumeUsd.toLocaleString()} shifted
          </p>
        </div>
        {stats.streakDays > 0 && (
          <div className="flex items-center gap-1 text-orange-400">
            <FaFire />
            <span className="text-sm font-bold">{stats.streakDays}</span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className="p-4 rounded-xl"
            style={{ backgroundColor: `${stats.tier.color}20` }}
          >
            <TierIcon
              className="text-4xl"
              style={{ color: stats.tier.color }}
            />
          </div>
          <div>
            <h3
              className="text-2xl font-bold"
              style={{ color: stats.tier.color }}
            >
              {stats.currentTier} Member
            </h3>
            <p className="text-gray-400">
              ${stats.lifetimeVolumeUsd.toLocaleString()} lifetime volume
            </p>
          </div>
        </div>
        {stats.streakDays > 0 && (
          <div className="flex items-center gap-2 bg-orange-500/20 px-4 py-2 rounded-xl">
            <FaFire className="text-orange-400 text-xl" />
            <div>
              <span className="text-orange-400 font-bold text-lg">
                {stats.streakDays}
              </span>
              <span className="text-orange-400/70 text-sm ml-1">
                day streak
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Progress to next tier */}
      {stats.nextTier && (
        <div className="mb-6 p-4 bg-gray-900/50 rounded-xl">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">
              Progress to {stats.nextTier.name}
            </span>
            <span className="text-white font-medium">
              {stats.progressToNextTier}%
            </span>
          </div>
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats.progressToNextTier}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(to right, ${stats.tier.color}, ${stats.nextTier.color})`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ${stats.volumeToNextTier.toLocaleString()} more to unlock{" "}
            {stats.nextTier.name}
          </p>
        </div>
      )}

      {/* Free topups */}
      {stats.freeTopupsAvailable > 0 && (
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="mb-6 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <FaGift className="text-3xl text-green-400" />
            <div>
              <p className="text-green-400 font-bold">
                {stats.freeTopupsAvailable} Free Top-up
                {stats.freeTopupsAvailable > 1 ? "s" : ""} Available!
              </p>
              <p className="text-sm text-green-400/70">
                Use them on your next gas refill
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 rounded-xl p-4 text-center">
          <FaBolt className="text-2xl text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.totalShifts}</p>
          <p className="text-xs text-gray-500">Total Shifts</p>
        </div>
        <div className="bg-gray-900/50 rounded-xl p-4 text-center">
          <FaRocket className="text-2xl text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {stats.gasPacksDelivered}
          </p>
          <p className="text-xs text-gray-500">Gas Packs</p>
        </div>
        <div className="bg-gray-900/50 rounded-xl p-4 text-center">
          <FaGift className="text-2xl text-pink-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {stats.zeroGasRescues}
          </p>
          <p className="text-xs text-gray-500">0-Gas Rescues</p>
        </div>
        <div className="bg-gray-900/50 rounded-xl p-4 text-center">
          <FaTrophy className="text-2xl text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {stats.freeTopupsUsed}
          </p>
          <p className="text-xs text-gray-500">Free Used</p>
        </div>
      </div>

      {/* Favorite chain */}
      {stats.favoriteChain && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Favorite chain:{" "}
          <span className="text-white font-medium uppercase">
            {stats.favoriteChain}
          </span>
        </div>
      )}
    </motion.div>
  );
}
