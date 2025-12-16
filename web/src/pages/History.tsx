import { useEffect, useState } from "react";
import {
  FaArrowRight,
  FaDownload,
  FaExchangeAlt,
  FaExternalLinkAlt,
  FaGasPump,
  FaGift,
  FaHistory,
  FaRocket,
  FaUsers,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import octaneAPI from "../services/api";

interface Activity {
  id: string;
  type: "shift" | "topup" | "gift" | "referral";
  action: string;
  chain?: string;
  amount?: string;
  amountUsd?: number;
  txHash?: string;
  details: Record<string, any>;
  createdAt: string;
}

interface Stats {
  totalShifts: number;
  totalTopUps: number;
  totalGifts: number;
  totalVolumeUsd: number;
  lastActive: string | null;
}

interface Shift {
  id: string;
  shiftId: string;
  status: string;
  type?: string;
  depositCoin: string;
  depositNetwork: string;
  depositAmount?: string;
  settleCoin: string;
  settleNetwork: string;
  settleAmount?: string;
  rate?: string;
  txHash?: string;
  createdAt: string;
}

// Animated stat card
function StatCard({
  icon,
  label,
  value,
  gradient,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  gradient: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div
        className={`absolute -inset-1 ${gradient} rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500`}
      />

      <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 h-full">
        <div className={`inline-flex p-3 rounded-xl ${gradient} mb-3`}>
          <span className="text-white">{icon}</span>
        </div>
        <div className="text-gray-400 text-sm mb-1">{label}</div>
        <div className="text-3xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const { address, isAuthenticated, signIn } = useWallet();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "shifts">("all");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (isAuthenticated && address) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, address]);

  const fetchHistory = async () => {
    try {
      setLoading(true);

      const [activitiesRes, shiftsRes] = await Promise.all([
        octaneAPI.getHistory(address!, {
          type: filter === "all" ? undefined : filter,
        }),
        octaneAPI.getShiftHistory(address!),
      ]);

      setActivities(activitiesRes.activities || []);
      setShifts(shiftsRes.shifts || []);

      // Calculate stats from actual shifts data (more accurate)
      const shiftsData = shiftsRes.shifts || [];
      const calculatedStats: Stats = {
        totalShifts: shiftsData.length,
        totalTopUps: activitiesRes.stats?.totalTopUps || 0,
        totalGifts: activitiesRes.stats?.totalGifts || 0,
        totalVolumeUsd: shiftsData.reduce((sum: number, s: Shift) => {
          // Estimate USD value from settle amount (rough estimate)
          const amount = parseFloat(s.settleAmount || s.depositAmount || "0");
          return sum + amount;
        }, 0),
        lastActive: shiftsData.length > 0 ? shiftsData[0].createdAt : null,
      };

      setStats(calculatedStats);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const exportHistory = async () => {
    try {
      const response = await octaneAPI.exportHistory(address!);
      const blob = new Blob([JSON.stringify(response, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `octaneshift-history-${Date.now()}.json`;
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "shift":
        return <FaExchangeAlt className="w-4 h-4 text-blue-400" />;
      case "topup":
        return <FaGasPump className="w-4 h-4 text-orange-400" />;
      case "gift":
        return <FaGift className="w-4 h-4 text-pink-400" />;
      case "referral":
        return <FaUsers className="w-4 h-4 text-purple-400" />;
      default:
        return <FaHistory className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "settled":
        return "bg-green-500/20 text-green-400";
      case "waiting":
      case "pending":
        return "bg-yellow-500/20 text-yellow-400";
      case "processing":
        return "bg-blue-500/20 text-blue-400";
      case "expired":
      case "refunded":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full border border-blue-500/30 mb-6">
              <FaHistory className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 text-sm font-medium">
                Track Everything
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Transaction History
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              View all your swaps, top-ups, gifts, and referrals in one
              beautiful dashboard
            </p>
          </div>

          {/* Feature Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500" />

            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/10 overflow-hidden">
              {/* Animated background */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse" />
                <div
                  className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl animate-pulse"
                  style={{ animationDelay: "1s" }}
                />
              </div>

              <div className="relative z-10 text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl blur-2xl opacity-50 animate-pulse" />
                  <div className="relative p-6 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl border border-blue-500/30">
                    <FaHistory className="w-16 h-16 text-blue-400" />
                  </div>
                </div>

                <h2 className="text-3xl font-bold mb-4">Track Your Activity</h2>
                <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                  Connect your wallet to access your complete transaction
                  history with detailed analytics and easy export options.
                </p>

                {/* Feature Grid */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <FaExchangeAlt className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <div className="font-semibold">All Swaps</div>
                    <div className="text-sm text-gray-500">
                      Track every shift
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <FaGasPump className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                    <div className="font-semibold">Gas Top-Ups</div>
                    <div className="text-sm text-gray-500">Monitor refills</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <FaDownload className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <div className="font-semibold">Easy Export</div>
                    <div className="text-sm text-gray-500">
                      Download as JSON
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => signIn()}
                  className="group relative inline-flex items-center gap-3 px-8 py-4 overflow-hidden rounded-2xl font-bold text-lg transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <span className="relative z-10 text-white">
                    Connect & View History
                  </span>
                  <FaRocket className="relative z-10 w-5 h-5 text-white group-hover:animate-bounce" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-4 text-gray-400">Loading your history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Transaction History
              </span>
            </h1>
            <p className="text-gray-400">All your activity in one place</p>
          </div>
          <button
            onClick={exportHistory}
            className="group relative inline-flex items-center gap-2 px-5 py-3 overflow-hidden rounded-xl font-semibold transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 border border-white/10 rounded-xl" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <FaDownload className="relative z-10 w-4 h-4 text-blue-400" />
            <span className="relative z-10 text-white">Export JSON</span>
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<FaExchangeAlt className="w-5 h-5" />}
              label="Total Shifts"
              value={stats.totalShifts}
              gradient="bg-gradient-to-r from-blue-500 to-indigo-500"
              delay={0}
            />
            <StatCard
              icon={<FaGasPump className="w-5 h-5" />}
              label="Total Top-Ups"
              value={stats.totalTopUps}
              gradient="bg-gradient-to-r from-orange-500 to-red-500"
              delay={100}
            />
            <StatCard
              icon={<FaGift className="w-5 h-5" />}
              label="Gifts Sent"
              value={stats.totalGifts}
              gradient="bg-gradient-to-r from-pink-500 to-rose-500"
              delay={200}
            />
            <StatCard
              icon={<span className="text-lg">💰</span>}
              label="Total Volume"
              value={`$${stats.totalVolumeUsd.toFixed(2)}`}
              gradient="bg-gradient-to-r from-green-500 to-emerald-500"
              delay={300}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("all")}
            className={`relative px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              activeTab === "all"
                ? "text-white"
                : "text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800"
            }`}
          >
            {activeTab === "all" && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl" />
            )}
            <span className="relative z-10">All Activity</span>
          </button>
          <button
            onClick={() => setActiveTab("shifts")}
            className={`relative px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              activeTab === "shifts"
                ? "text-white"
                : "text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800"
            }`}
          >
            {activeTab === "shifts" && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl" />
            )}
            <span className="relative z-10">Shifts Only</span>
          </button>
        </div>

        {/* Filter for All Activity */}
        {activeTab === "all" && (
          <div className="flex flex-wrap gap-2 mb-6">
            {["all", "shift", "topup", "gift", "referral"].map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  fetchHistory();
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  filter === f
                    ? "bg-white/10 text-white border border-white/20"
                    : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
              </button>
            ))}
          </div>
        )}

        {/* Activity List */}
        {activeTab === "all" && (
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-gray-500/10 to-gray-600/10 rounded-3xl blur-xl" />

            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
              {activities.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 bg-gray-800/50 rounded-2xl mb-4">
                    <FaHistory className="w-12 h-12 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Activity Yet</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Your transactions will appear here once you start using
                    OctaneShift.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {activities.map((activity, index) => (
                    <div
                      key={activity.id}
                      className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors duration-200"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          activity.type === "shift"
                            ? "bg-blue-500/20"
                            : activity.type === "topup"
                            ? "bg-orange-500/20"
                            : activity.type === "gift"
                            ? "bg-pink-500/20"
                            : "bg-purple-500/20"
                        }`}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white capitalize">
                          {activity.type} - {activity.action}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {activity.chain && `${activity.chain} • `}
                          {new Date(activity.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {activity.amount && (
                        <div className="text-right">
                          <div className="font-mono text-white">
                            {activity.amount}
                          </div>
                          {activity.amountUsd && (
                            <div className="text-sm text-gray-500">
                              ${activity.amountUsd.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shifts List */}
        {activeTab === "shifts" && (
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-gray-500/10 to-gray-600/10 rounded-3xl blur-xl" />

            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
              {shifts.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 bg-gray-800/50 rounded-2xl mb-4">
                    <FaExchangeAlt className="w-12 h-12 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No Shifts Yet</h3>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Create your first shift to start swapping crypto!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {shifts.map((shift, index) => (
                    <div
                      key={shift.id}
                      className="p-5 hover:bg-white/5 transition-colors duration-200"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-gray-800/80 rounded-lg font-mono text-sm text-gray-400">
                            {shift.shiftId}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(
                              shift.status
                            )}`}
                          >
                            {shift.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-500">
                            {new Date(shift.createdAt).toLocaleString()}
                          </span>
                          <button
                            onClick={() => navigate(`/proof/${shift.shiftId}`)}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
                          >
                            View Proof
                            <FaExternalLinkAlt className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex-1 p-4 bg-gray-800/50 rounded-xl">
                          <div className="text-xs text-gray-500 mb-1">From</div>
                          <div className="text-xl font-bold text-white">
                            {shift.depositAmount} {shift.depositCoin}
                          </div>
                          <div className="text-sm text-gray-500">
                            {shift.depositNetwork}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                            <FaArrowRight className="w-4 h-4 text-white" />
                          </div>
                        </div>

                        <div className="flex-1 p-4 bg-gray-800/50 rounded-xl text-right">
                          <div className="text-xs text-gray-500 mb-1">To</div>
                          <div className="text-xl font-bold text-white">
                            {shift.settleAmount} {shift.settleCoin}
                          </div>
                          <div className="text-sm text-gray-500">
                            {shift.settleNetwork}
                          </div>
                        </div>
                      </div>

                      {shift.rate && (
                        <div className="mt-3 text-sm text-gray-500 text-center">
                          Rate:{" "}
                          <span className="text-gray-400">{shift.rate}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-2xl text-red-400 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
