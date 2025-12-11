import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FaChartLine,
  FaCheckCircle,
  FaCrown,
  FaGasPump,
  FaGift,
  FaHistory,
  FaMedal,
  FaRocket,
  FaStar,
  FaTrophy,
} from "react-icons/fa";
import api from "../services/api";

// Mock user ID for demo - in production would come from auth
const DEMO_USER_ID =
  "demo-user-" +
  (localStorage.getItem("octane_user_id") ||
    Math.random().toString(36).substr(2, 9));

// Save user ID to localStorage
if (!localStorage.getItem("octane_user_id")) {
  localStorage.setItem("octane_user_id", DEMO_USER_ID);
}

interface LoyaltyStats {
  userId: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  totalVolume: number;
  totalShifts: number;
  totalGasTopups: number;
  freeTopupsAvailable: number;
  freeTopupsUsed: number;
  nextTierProgress: number;
  nextTierRequirement: number;
  benefits: string[];
  joinDate: string;
  streakDays: number;
}

interface RewardHistory {
  id: string;
  type: string;
  amount: number;
  date: string;
  status: "claimed" | "pending";
}

const tierColors = {
  bronze: "from-amber-600 to-amber-800",
  silver: "from-gray-400 to-gray-600",
  gold: "from-yellow-400 to-yellow-600",
  platinum: "from-purple-400 to-purple-600",
};

const tierIcons = {
  bronze: FaMedal,
  silver: FaStar,
  gold: FaCrown,
  platinum: FaTrophy,
};

const tierRequirements = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 10000,
};

export default function Loyalty() {
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [rewardHistory] = useState<RewardHistory[]>([
    {
      id: "1",
      type: "Free Gas Top-up",
      amount: 1,
      date: "2024-01-15",
      status: "claimed",
    },
    {
      id: "2",
      type: "Volume Bonus",
      amount: 5,
      date: "2024-01-10",
      status: "claimed",
    },
    {
      id: "3",
      type: "Streak Reward",
      amount: 2,
      date: "2024-01-05",
      status: "claimed",
    },
  ]);

  useEffect(() => {
    fetchLoyaltyStats();
  }, []);

  const fetchLoyaltyStats = async () => {
    setLoading(true);
    try {
      const response = await api.getLoyaltyStats(DEMO_USER_ID);
      // Handle API response - ensure all required fields exist
      const data = response.data || response;

      // Handle tier - it might be a string or an object with a name property
      let tierName = "bronze";
      if (typeof data.tier === "string") {
        tierName = data.tier;
      } else if (data.tier?.name) {
        tierName = data.tier.name;
      } else if (typeof data.currentTier === "string") {
        tierName = data.currentTier;
      } else if (data.currentTier?.name) {
        tierName = data.currentTier.name;
      }

      setStats({
        userId: data.userId || DEMO_USER_ID,
        tier:
          (tierName as "bronze" | "silver" | "gold" | "platinum") || "bronze",
        totalVolume: data.totalVolume || data.lifetimeVolumeUsd || 0,
        totalShifts: data.totalShifts || 0,
        totalGasTopups: data.totalGasTopups || data.gasTopups || 0,
        freeTopupsAvailable: data.freeTopupsAvailable || 0,
        freeTopupsUsed: data.freeTopupsUsed || 0,
        nextTierProgress:
          data.nextTierProgress ||
          data.totalVolume ||
          data.lifetimeVolumeUsd ||
          0,
        nextTierRequirement: data.nextTierRequirement || 500,
        benefits: Array.isArray(data.benefits)
          ? data.benefits
          : ["0.1% fee discount", "Priority support"],
        joinDate: data.joinDate || data.createdAt || new Date().toISOString(),
        streakDays: data.streakDays || 0,
      });
    } catch (err) {
      // Generate mock stats for demo
      setStats({
        userId: DEMO_USER_ID,
        tier: "silver",
        totalVolume: 847.5,
        totalShifts: 23,
        totalGasTopups: 15,
        freeTopupsAvailable: 2,
        freeTopupsUsed: 3,
        nextTierProgress: 847.5,
        nextTierRequirement: 2000,
        benefits: [
          "0.1% fee discount",
          "Priority support",
          "Early access to features",
          "1 free top-up per $500 volume",
        ],
        joinDate: "2024-01-01",
        streakDays: 7,
      });
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async () => {
    if (!stats || stats.freeTopupsAvailable <= 0) return;

    setClaiming(true);
    try {
      await api.useFreeTopup(DEMO_USER_ID);
      setClaimSuccess(true);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              freeTopupsAvailable: prev.freeTopupsAvailable - 1,
              freeTopupsUsed: prev.freeTopupsUsed + 1,
            }
          : null
      );

      setTimeout(() => setClaimSuccess(false), 3000);
    } catch (err) {
      // Demo: simulate success
      setClaimSuccess(true);
      setStats((prev) =>
        prev
          ? {
              ...prev,
              freeTopupsAvailable: prev.freeTopupsAvailable - 1,
              freeTopupsUsed: prev.freeTopupsUsed + 1,
            }
          : null
      );
      setTimeout(() => setClaimSuccess(false), 3000);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Failed to load loyalty data</p>
      </div>
    );
  }

  // Ensure tier is a string
  const tierName = String(
    stats.tier || "bronze"
  ).toLowerCase() as keyof typeof tierColors;
  const safeTierName = ["bronze", "silver", "gold", "platinum"].includes(
    tierName
  )
    ? tierName
    : "bronze";

  const TierIcon = tierIcons[safeTierName] || FaMedal;
  const progressPercent = Math.min(
    ((stats.nextTierProgress || 0) / (stats.nextTierRequirement || 1)) * 100,
    100
  );
  const nextTier =
    safeTierName === "bronze"
      ? "silver"
      : safeTierName === "silver"
      ? "gold"
      : safeTierName === "gold"
      ? "platinum"
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            <span className="text-orange-500">Octane</span> Rewards
          </h1>
          <p className="text-gray-400">Earn rewards for using OctaneShift</p>
        </motion.div>

        {/* Tier Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-gradient-to-r ${tierColors[safeTierName]} rounded-2xl p-8 mb-8 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <TierIcon className="text-4xl text-white" />
                <span className="text-3xl font-bold text-white capitalize">
                  {safeTierName} Member
                </span>
              </div>
              <p className="text-white/80">
                Member since {new Date(stats.joinDate).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <FaRocket className="text-white/80" />
                <span className="text-white/80">
                  {stats.streakDays} day streak
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl font-bold text-white">
                ${(stats.totalVolume || 0).toFixed(2)}
              </div>
              <div className="text-white/80">Total Volume</div>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="relative z-10 mt-6">
              <div className="flex justify-between text-sm text-white/80 mb-2">
                <span>Progress to {nextTier}</span>
                <span>
                  ${(stats.nextTierProgress || 0).toFixed(0)} / $
                  {stats.nextTierRequirement || 0}
                </span>
              </div>
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-white rounded-full"
                />
              </div>
              <p className="text-white/60 text-sm mt-2">
                $
                {(
                  (stats.nextTierRequirement || 0) -
                  (stats.nextTierProgress || 0)
                ).toFixed(0)}{" "}
                more to unlock {nextTier} benefits
              </p>
            </div>
          )}
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Shifts",
              value: stats.totalShifts,
              icon: FaHistory,
            },
            {
              label: "Gas Top-ups",
              value: stats.totalGasTopups,
              icon: FaGasPump,
            },
            {
              label: "Free Top-ups Used",
              value: stats.freeTopupsUsed,
              icon: FaGift,
            },
            { label: "Day Streak", value: stats.streakDays, icon: FaChartLine },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-gray-800/50 rounded-xl p-4 text-center"
            >
              <stat.icon className="text-2xl text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Rewards Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Available Rewards */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaGift className="text-orange-500" />
              Available Rewards
            </h3>

            {stats.freeTopupsAvailable > 0 ? (
              <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      Free Gas Top-ups
                    </div>
                    <div className="text-gray-400">
                      {stats.freeTopupsAvailable} available
                    </div>
                  </div>
                  <FaGasPump className="text-3xl text-orange-500" />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={claimReward}
                  disabled={claiming || claimSuccess}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    claimSuccess
                      ? "bg-green-500 text-white"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                >
                  {claimSuccess ? (
                    <span className="flex items-center justify-center gap-2">
                      <FaCheckCircle /> Claimed!
                    </span>
                  ) : claiming ? (
                    "Claiming..."
                  ) : (
                    "Claim Free Top-up"
                  )}
                </motion.button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FaGift className="text-4xl mx-auto mb-3 opacity-50" />
                <p>No rewards available</p>
                <p className="text-sm">Keep using OctaneShift to earn more!</p>
              </div>
            )}
          </motion.div>

          {/* Tier Benefits */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaCrown className="text-orange-500" />
              {safeTierName.charAt(0).toUpperCase() +
                safeTierName.slice(1)}{" "}
              Benefits
            </h3>

            <ul className="space-y-3">
              {(stats.benefits || []).map((benefit, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-gray-300"
                >
                  <FaCheckCircle className="text-green-500 flex-shrink-0" />
                  {benefit}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Reward History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FaHistory className="text-orange-500" />
            Reward History
          </h3>

          {rewardHistory.length > 0 ? (
            <div className="space-y-3">
              {rewardHistory.map((reward) => (
                <div
                  key={reward.id}
                  className="flex items-center justify-between bg-gray-700/50 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <FaGift className="text-orange-500" />
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {reward.type}
                      </div>
                      <div className="text-gray-400 text-sm">{reward.date}</div>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      reward.status === "claimed"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {reward.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">
              No rewards history yet
            </p>
          )}
        </motion.div>

        {/* Tier Progress Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-gray-800/50 rounded-xl p-6"
        >
          <h3 className="text-xl font-bold text-white mb-6">All Tiers</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => {
              const TIcon = tierIcons[tier];
              const isCurrentTier = tier === safeTierName;
              const isUnlocked =
                tierRequirements[tier] <= (stats.totalVolume || 0);

              return (
                <div
                  key={tier}
                  className={`relative rounded-xl p-4 text-center transition-all ${
                    isCurrentTier
                      ? `bg-gradient-to-br ${tierColors[tier]} ring-2 ring-white/50`
                      : isUnlocked
                      ? "bg-gray-700/50"
                      : "bg-gray-800/30 opacity-50"
                  }`}
                >
                  {isCurrentTier && (
                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                      Current
                    </span>
                  )}
                  <TIcon
                    className={`text-3xl mx-auto mb-2 ${
                      isCurrentTier ? "text-white" : "text-gray-400"
                    }`}
                  />
                  <div
                    className={`font-semibold capitalize ${
                      isCurrentTier ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {tier}
                  </div>
                  <div
                    className={`text-sm ${
                      isCurrentTier ? "text-white/80" : "text-gray-500"
                    }`}
                  >
                    ${tierRequirements[tier]}+
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
