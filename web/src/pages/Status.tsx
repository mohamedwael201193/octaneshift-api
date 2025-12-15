import axios from "axios";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  ExternalLink,
  Loader2,
  Search,
  TestTube,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

interface ShiftItem {
  id: string;
  status: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  createdAt: string;
  depositAmount?: string;
  settleAmount?: string;
}

interface StatusData {
  uptime: {
    seconds: number;
    formatted: string;
  };
  shifts: {
    today: number;
    last24h: number;
    completed: number;
    failed: number;
    pending: number;
  };
  successRate: number;
  topChains: Array<{ chain: string; count: number }>;
  topCoins: Array<{ coin: string; count: number }>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Status() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [recentShifts, setRecentShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [testAlertLoading, setTestAlertLoading] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<string | null>(null);
  const [shiftLookupId, setShiftLookupId] = useState<string>("");

  const handleShiftLookup = () => {
    if (shiftLookupId.trim()) {
      navigate(`/proof/${shiftLookupId.trim()}`);
    } else {
      toast.error("Please enter a shift ID");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, shiftsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/status`),
          axios
            .get(`${API_BASE_URL}/api/shifts/recent`)
            .catch(() => ({ data: { success: false } })),
        ]);

        if (statusRes.data.success) {
          setStatus(statusRes.data.data);
        }
        if (shiftsRes.data.success && shiftsRes.data.data) {
          setRecentShifts(shiftsRes.data.data);
        }
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(axiosError.response?.data?.error || "Failed to fetch status");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTestAlert = async () => {
    setTestAlertLoading(true);
    setTestAlertResult(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/test-alert`);
      if (response.data.success) {
        setTestAlertResult(
          `✅ ${
            response.data.message ||
            "Test alert sent! Check Telegram bot for notification."
          }`
        );
      }
    } catch (err: any) {
      setTestAlertResult(
        `❌ ${err.response?.data?.error || "Failed to send test alert"}`
      );
    } finally {
      setTestAlertLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">
            {error || "Failed to load status"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                System Status
              </h1>
              <p className="text-gray-400">
                Real-time metrics and performance data
              </p>
            </div>
            <button
              onClick={handleTestAlert}
              disabled={testAlertLoading}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testAlertLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <TestTube className="w-5 h-5" />
                  🧪 Send Test Alert
                </>
              )}
            </button>
          </div>
          {testAlertResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg ${
                testAlertResult.startsWith("✅")
                  ? "bg-green-900/30 border border-green-700/50 text-green-300"
                  : "bg-red-900/30 border border-red-700/50 text-red-300"
              }`}
            >
              {testAlertResult}
            </motion.div>
          )}

          {/* Shift Lookup */}
          <div className="mt-4 flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Enter Shift ID to view order..."
                value={shiftLookupId}
                onChange={(e) => setShiftLookupId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShiftLookup()}
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={handleShiftLookup}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
            >
              View Shift
            </button>
          </div>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Uptime */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/50 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-green-400" />
              <span className="text-xs text-green-400 font-semibold uppercase tracking-wide">
                Uptime
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {status.uptime.formatted}
            </div>
            <div className="text-sm text-green-300">
              {status.uptime.seconds.toLocaleString()} seconds
            </div>
          </motion.div>

          {/* Shifts Today */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700/50 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Zap className="w-8 h-8 text-blue-400" />
              <span className="text-xs text-blue-400 font-semibold uppercase tracking-wide">
                Today
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {status.shifts.today}
            </div>
            <div className="text-sm text-blue-300">Shifts created today</div>
          </motion.div>

          {/* Success Rate */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/50 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <span className="text-xs text-purple-400 font-semibold uppercase tracking-wide">
                Success Rate
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {status.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-purple-300">Last 24 hours</div>
          </motion.div>

          {/* Total Last 24h */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 border border-orange-700/50 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-orange-400" />
              <span className="text-xs text-orange-400 font-semibold uppercase tracking-wide">
                24h Volume
              </span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {status.shifts.last24h}
            </div>
            <div className="text-sm text-orange-300">Total shifts</div>
          </motion.div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Shift Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Shift Breakdown (24h)
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Completed</span>
                <span className="text-green-400 font-semibold text-lg">
                  {status.shifts.completed}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Pending</span>
                <span className="text-yellow-400 font-semibold text-lg">
                  {status.shifts.pending}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Failed</span>
                <span className="text-red-400 font-semibold text-lg">
                  {status.shifts.failed}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Top Chains */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Top Chains (24h)
            </h2>
            <div className="space-y-3">
              {status.topChains.length > 0 ? (
                status.topChains.map((chain, index) => (
                  <div
                    key={chain.chain}
                    className="flex justify-between items-center"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-mono text-sm">
                        #{index + 1}
                      </span>
                      <span className="text-white font-medium">
                        {chain.chain}
                      </span>
                    </div>
                    <span className="text-blue-400 font-semibold">
                      {chain.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No data yet</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Top Coins */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Top Coins (24h)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {status.topCoins.length > 0 ? (
              status.topCoins.map((coin, index) => (
                <div
                  key={coin.coin}
                  className="bg-gray-900/50 rounded-lg p-4 flex justify-between items-center"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-mono text-sm">
                      #{index + 1}
                    </span>
                    <span className="text-white font-medium">{coin.coin}</span>
                  </div>
                  <span className="text-yellow-400 font-semibold">
                    {coin.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4 col-span-full">
                No data yet
              </p>
            )}
          </div>
        </motion.div>

        {/* Recent Shifts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mt-8"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Recent Shifts
          </h2>
          <div className="space-y-3">
            {recentShifts.length > 0 ? (
              recentShifts.map((shift) => (
                <div
                  key={shift.id}
                  onClick={() => navigate(`/proof/${shift.id}`)}
                  className="bg-gray-900/50 hover:bg-gray-900 rounded-lg p-4 cursor-pointer transition-colors border border-transparent hover:border-cyan-500/30 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Status Badge */}
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                          shift.status === "waiting"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : shift.status === "settled" ||
                              shift.status === "complete"
                            ? "bg-green-500/20 text-green-400"
                            : shift.status === "expired"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {shift.status}
                      </span>

                      {/* Swap Pair */}
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {shift.depositCoin.toUpperCase()}
                        </span>
                        <span className="text-gray-500 text-sm">
                          ({shift.depositNetwork})
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                        <span className="text-white font-medium">
                          {shift.settleCoin.toUpperCase()}
                        </span>
                        <span className="text-gray-500 text-sm">
                          ({shift.settleNetwork})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Shift ID */}
                      <span className="font-mono text-gray-400 text-sm hidden sm:inline">
                        {shift.id.slice(0, 8)}...
                      </span>

                      {/* View Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/proof/${shift.id}`);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
                      >
                        View Proof
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="mt-2 text-xs text-gray-500">
                    Created: {new Date(shift.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                No recent shifts. Create your first shift to see it here!
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
