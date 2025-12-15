import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FaArrowDown,
  FaArrowUp,
  FaBolt,
  FaChartLine,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaGasPump,
  FaPlus,
  FaSearch,
  FaSyncAlt,
  FaWallet,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import api from "../services/api";

interface GasPrice {
  chain: string;
  symbol: string;
  gasPrice: string;
  gasPriceGwei?: number;
  costPerTx: number;
  unit: string;
  trend: "up" | "down" | "stable";
  change24h: number;
}

interface ChainBalance {
  chain: string;
  chainName: string;
  symbol: string;
  balance: number;
  balanceFormatted: string;
  balanceUSD?: number;
  txsRemaining: number;
  healthStatus: "healthy" | "low" | "critical";
  costPerTx: number;
  error: string | null;
}

interface GasPreset {
  label: string;
  description: string;
  amountNative: number;
  amountUsd: number;
  txCount: number;
}

const chainIcons: { [key: string]: string } = {
  eth: "⟠",
  ethereum: "⟠",
  pol: "⬡",
  polygon: "⬡",
  arb: "🔷",
  arbitrum: "🔷",
  op: "🔴",
  optimism: "🔴",
  avax: "🔺",
  avalanche: "🔺",
  bsc: "🟡",
  solana: "◎",
  base: "🔵",
};

const chainColors: { [key: string]: string } = {
  eth: "from-blue-500 to-purple-500",
  ethereum: "from-blue-500 to-purple-500",
  pol: "from-purple-500 to-pink-500",
  polygon: "from-purple-500 to-pink-500",
  arb: "from-blue-400 to-blue-600",
  arbitrum: "from-blue-400 to-blue-600",
  op: "from-red-500 to-red-700",
  optimism: "from-red-500 to-red-700",
  avax: "from-red-400 to-red-600",
  avalanche: "from-red-400 to-red-600",
  bsc: "from-yellow-400 to-yellow-600",
  solana: "from-purple-400 to-green-400",
  base: "from-blue-500 to-blue-700",
};

export default function GasDashboard() {
  const [gasPrices, setGasPrices] = useState<GasPrice[]>([]);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [selectedChain, setSelectedChain] = useState<string>("eth");
  const [presets, setPresets] = useState<GasPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [savedAddress, setSavedAddress] = useState<string>("");

  // Load saved address from localStorage on mount - use same key as auth system
  useEffect(() => {
    const saved = localStorage.getItem("octaneshift_wallet_address");
    if (saved) {
      setWalletAddress(saved);
      setSavedAddress(saved);
    }
  }, []);

  useEffect(() => {
    fetchGasPrices();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchGasPrices();
        if (savedAddress) {
          fetchBalances(savedAddress);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, savedAddress]);

  useEffect(() => {
    fetchPresets(selectedChain);
  }, [selectedChain]);

  // Fetch balances when savedAddress changes
  useEffect(() => {
    if (savedAddress) {
      fetchBalances(savedAddress);
    }
  }, [savedAddress]);

  const fetchGasPrices = async () => {
    setLoading(true);
    try {
      const response = await api.getGasPrices();
      // Transform the prices object into an array
      const pricesArray = Object.entries(response.prices || {}).map(
        ([chain, data]: [string, any]) => ({
          chain,
          symbol: data.symbol || chain.toUpperCase(),
          gasPrice: `${data.gasPriceGwei?.toFixed(2) || "0"} gwei`,
          gasPriceGwei: data.gasPriceGwei,
          costPerTx: data.costPerTxUsd || 0,
          unit: "gwei",
          trend: "stable" as const,
          change24h: 0,
        })
      );
      setGasPrices(pricesArray);
    } catch (err) {
      console.error("Failed to fetch gas prices:", err);
      toast.error("Failed to fetch gas prices");
    }
    setLastUpdated(new Date());
    setLoading(false);
  };

  const fetchBalances = async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return;
    }

    setBalancesLoading(true);
    try {
      const response = await api.getWalletBalances(address);
      if (response.success && response.data?.balances) {
        setBalances(response.data.balances);
      }
    } catch (err) {
      console.error("Failed to fetch balances:", err);
      toast.error("Failed to fetch wallet balances");
    }
    setBalancesLoading(false);
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      toast.error("Please enter a valid EVM address (0x...)");
      return;
    }
    localStorage.setItem("octaneshift_wallet_address", walletAddress);
    setSavedAddress(walletAddress);
    toast.success("Wallet address saved!");
  };

  const fetchPresets = async (chain: string) => {
    try {
      const response = await api.getSmartPresets(chain);
      if (response.presets) {
        setPresets(response.presets);
      }
    } catch (err) {
      console.error("Failed to fetch presets:", err);
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-400";
      case "low":
        return "text-yellow-400";
      case "critical":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getHealthBg = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500/20";
      case "low":
        return "bg-yellow-500/20";
      case "critical":
        return "bg-red-500/20";
      default:
        return "bg-gray-500/20";
    }
  };

  const criticalChains = balances.filter(
    (b) => b.healthStatus === "critical"
  ).length;
  const lowChains = balances.filter((b) => b.healthStatus === "low").length;
  const healthyChains = balances.filter(
    (b) => b.healthStatus === "healthy"
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-white">
              <FaGasPump className="inline text-orange-500 mr-3" />
              Gas Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              Monitor gas prices and manage your balances across all chains
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                autoRefresh
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              <FaSyncAlt className={autoRefresh ? "animate-spin" : ""} />
              Auto-refresh
            </button>
            <button
              onClick={() => {
                fetchGasPrices();
                if (savedAddress) fetchBalances(savedAddress);
              }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Wallet Address Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl p-6 mb-8"
        >
          <form onSubmit={handleAddressSubmit} className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-2">
                <FaWallet className="inline mr-2" />
                Your Wallet Address
              </label>
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <FaSearch />
                Track Wallet
              </button>
            </div>
          </form>
          {savedAddress && (
            <p className="text-sm text-gray-400 mt-2">
              Tracking:{" "}
              <span className="text-orange-400 font-mono">
                {savedAddress.slice(0, 10)}...{savedAddress.slice(-8)}
              </span>
            </p>
          )}
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <div className="text-gray-400 text-sm mb-1">Tracked Chains</div>
            <div className="text-3xl font-bold text-white">
              {balances.length}
            </div>
            <div className="text-green-400 text-sm mt-1">
              {savedAddress ? "Live balances" : "Enter wallet to track"}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <div className="text-gray-400 text-sm mb-1">Health Status</div>
            <div className="flex items-center gap-2">
              {!savedAddress ? (
                <span className="text-gray-400">No wallet tracked</span>
              ) : criticalChains > 0 ? (
                <>
                  <FaExclamationTriangle className="text-red-400 text-2xl" />
                  <span className="text-2xl font-bold text-red-400">
                    {criticalChains} Critical
                  </span>
                </>
              ) : lowChains > 0 ? (
                <>
                  <FaExclamationTriangle className="text-yellow-400 text-2xl" />
                  <span className="text-2xl font-bold text-yellow-400">
                    {lowChains} Low
                  </span>
                </>
              ) : balances.length > 0 ? (
                <>
                  <FaCheckCircle className="text-green-400 text-2xl" />
                  <span className="text-2xl font-bold text-green-400">
                    All Good
                  </span>
                </>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <div className="text-gray-400 text-sm mb-1">Cheapest Gas</div>
            <div className="text-2xl font-bold text-white capitalize">
              {gasPrices.sort((a, b) => a.costPerTx - b.costPerTx)[0]?.chain ||
                "Solana"}
            </div>
            <div className="text-green-400 text-sm mt-1">
              $
              {gasPrices
                .sort((a, b) => a.costPerTx - b.costPerTx)[0]
                ?.costPerTx.toFixed(4) || "0.0001"}
              /tx
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <div className="text-gray-400 text-sm mb-1">Last Updated</div>
            <div className="text-xl font-bold text-white">
              <FaClock className="inline mr-2 text-orange-500" />
              {lastUpdated.toLocaleTimeString()}
            </div>
            <div className="text-gray-500 text-sm mt-1">Updates every 30s</div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Gas Prices Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-2 bg-gray-800/50 rounded-xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaChartLine className="text-orange-500" />
              Live Gas Prices
            </h2>

            <div className="space-y-3">
              <AnimatePresence>
                {gasPrices.map((gas, i) => (
                  <motion.div
                    key={gas.chain}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedChain(gas.chain)}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all ${
                      selectedChain === gas.chain
                        ? "bg-orange-500/20 border border-orange-500/50"
                        : "bg-gray-700/50 hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                          chainColors[gas.chain] || "from-gray-500 to-gray-700"
                        } flex items-center justify-center text-xl`}
                      >
                        {chainIcons[gas.chain] || "⬡"}
                      </div>
                      <div>
                        <div className="text-white font-semibold capitalize">
                          {gas.chain}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {gas.gasPrice}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-white font-semibold">
                        ${gas.costPerTx.toFixed(4)}/tx
                      </div>
                      <div
                        className={`text-sm flex items-center justify-end gap-1 ${
                          gas.trend === "up"
                            ? "text-red-400"
                            : gas.trend === "down"
                            ? "text-green-400"
                            : "text-gray-400"
                        }`}
                      >
                        {gas.trend === "up" ? (
                          <FaArrowUp />
                        ) : gas.trend === "down" ? (
                          <FaArrowDown />
                        ) : null}
                        {Math.abs(gas.change24h).toFixed(1)}%
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Quick Top-up Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FaBolt className="text-orange-500" />
              Quick Top-up
            </h2>

            <div className="mb-4">
              <div className="text-gray-400 text-sm mb-2">Selected Chain</div>
              <div
                className={`p-3 rounded-lg bg-gradient-to-r ${
                  chainColors[selectedChain] || "from-gray-600 to-gray-700"
                }`}
              >
                <div className="flex items-center gap-2 text-white">
                  <span className="text-2xl">
                    {chainIcons[selectedChain] || "⬡"}
                  </span>
                  <span className="font-semibold capitalize">
                    {selectedChain}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {presets.map((preset, i) => (
                <Link
                  key={i}
                  to={`/topup?chain=${selectedChain}&amount=${preset.amount}`}
                  className="block w-full p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">
                        {preset.name}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {preset.description}
                      </div>
                    </div>
                    <div className="text-orange-400 font-semibold">
                      ${preset.amount}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              to={`/topup?chain=${selectedChain}`}
              className="block w-full py-3 bg-orange-500 hover:bg-orange-600 text-white text-center rounded-lg font-semibold transition-colors"
            >
              <FaPlus className="inline mr-2" />
              Custom Amount
            </Link>
          </motion.div>
        </div>

        {/* Chain Balances */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-gray-800/50 rounded-xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FaWallet className="text-orange-500" />
            Your Gas Balances
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((balance, i) => (
              <motion.div
                key={balance.chain}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-xl border ${
                  balance.healthStatus === "critical"
                    ? "border-red-500/50 bg-red-500/10"
                    : balance.healthStatus === "low"
                    ? "border-yellow-500/50 bg-yellow-500/10"
                    : "border-gray-700 bg-gray-700/30"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {chainIcons[balance.chain] || "⬡"}
                    </span>
                    <span className="text-white font-semibold capitalize">
                      {balance.chain}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${getHealthBg(
                      balance.healthStatus
                    )} ${getHealthColor(balance.healthStatus)}`}
                  >
                    {balance.healthStatus}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {balance.balance} {balance.symbol}
                    </div>
                    <div className="text-gray-400">
                      ${(balance.balanceUSD ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-semibold ${getHealthColor(
                        balance.healthStatus
                      )}`}
                    >
                      ~{balance.txsRemaining} txs
                    </div>
                    <div className="text-gray-500 text-sm">remaining</div>
                  </div>
                </div>

                {balance.healthStatus !== "healthy" && (
                  <Link
                    to={`/topup?chain=${balance.chain}`}
                    className="mt-3 block w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-center rounded-lg text-sm font-semibold transition-colors"
                  >
                    Top Up Now
                  </Link>
                )}
              </motion.div>
            ))}
          </div>

          <p className="text-gray-500 text-sm mt-4 text-center">
            Connect your wallet to see your actual balances across all chains
          </p>
        </motion.div>
      </div>
    </div>
  );
}
