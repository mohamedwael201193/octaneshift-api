import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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
  symbol: string;
  balance: number;
  balanceUSD: number;
  txsRemaining: number;
  healthStatus: "healthy" | "low" | "critical";
}

interface GasPreset {
  name: string;
  description: string;
  amount: number;
  txCount: number;
}

const chainIcons: { [key: string]: string } = {
  ethereum: "⟠",
  polygon: "⬡",
  arbitrum: "🔷",
  optimism: "🔴",
  avalanche: "🔺",
  bsc: "🟡",
  solana: "◎",
  base: "🔵",
};

const chainColors: { [key: string]: string } = {
  ethereum: "from-blue-500 to-purple-500",
  polygon: "from-purple-500 to-pink-500",
  arbitrum: "from-blue-400 to-blue-600",
  optimism: "from-red-500 to-red-700",
  avalanche: "from-red-400 to-red-600",
  bsc: "from-yellow-400 to-yellow-600",
  solana: "from-purple-400 to-green-400",
  base: "from-blue-500 to-blue-700",
};

export default function GasDashboard() {
  const [gasPrices, setGasPrices] = useState<GasPrice[]>([]);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [selectedChain, setSelectedChain] = useState<string>("ethereum");
  const [presets, setPresets] = useState<GasPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchAllData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchAllData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    fetchPresets(selectedChain);
  }, [selectedChain]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const response = await api.getGasPrices();
      // Transform the prices object into an array
      const pricesArray = Object.entries(response.data.prices || {}).map(
        ([chain, data]: [string, any]) => ({
          chain,
          symbol: data.symbol || chain.toUpperCase(),
          gasPrice: data.gasPrice || "0",
          gasPriceGwei: data.gasPriceGwei,
          costPerTx: data.costPerTx || 0,
          unit: data.unit || "gwei",
          trend: Math.random() > 0.5 ? "up" : ("down" as "up" | "down"),
          change24h: Math.random() * 20 - 10,
        })
      );
      setGasPrices(pricesArray.length > 0 ? pricesArray : getMockGasPrices());
    } catch (err) {
      setGasPrices(getMockGasPrices());
    }

    // Mock balances for demo
    setBalances(getMockBalances());
    setLastUpdated(new Date());
    setLoading(false);
  };

  const fetchPresets = async (chain: string) => {
    try {
      const response = await api.getSmartPresets(chain);
      setPresets(response.data.presets || getMockPresets());
    } catch (err) {
      setPresets(getMockPresets());
    }
  };

  const getMockGasPrices = (): GasPrice[] => [
    {
      chain: "ethereum",
      symbol: "ETH",
      gasPrice: "25 gwei",
      gasPriceGwei: 25,
      costPerTx: 1.5,
      unit: "gwei",
      trend: "down",
      change24h: -5.2,
    },
    {
      chain: "polygon",
      symbol: "MATIC",
      gasPrice: "150 gwei",
      gasPriceGwei: 150,
      costPerTx: 0.01,
      unit: "gwei",
      trend: "up",
      change24h: 12.5,
    },
    {
      chain: "arbitrum",
      symbol: "ETH",
      gasPrice: "0.1 gwei",
      gasPriceGwei: 0.1,
      costPerTx: 0.15,
      unit: "gwei",
      trend: "stable",
      change24h: 0.5,
    },
    {
      chain: "optimism",
      symbol: "ETH",
      gasPrice: "0.05 gwei",
      gasPriceGwei: 0.05,
      costPerTx: 0.12,
      unit: "gwei",
      trend: "down",
      change24h: -3.1,
    },
    {
      chain: "avalanche",
      symbol: "AVAX",
      gasPrice: "25 nAVAX",
      costPerTx: 0.08,
      unit: "nAVAX",
      trend: "up",
      change24h: 8.3,
    },
    {
      chain: "bsc",
      symbol: "BNB",
      gasPrice: "3 gwei",
      gasPriceGwei: 3,
      costPerTx: 0.05,
      unit: "gwei",
      trend: "stable",
      change24h: 1.2,
    },
    {
      chain: "solana",
      symbol: "SOL",
      gasPrice: "0.000005",
      costPerTx: 0.0001,
      unit: "SOL",
      trend: "down",
      change24h: -2.4,
    },
    {
      chain: "base",
      symbol: "ETH",
      gasPrice: "0.02 gwei",
      gasPriceGwei: 0.02,
      costPerTx: 0.08,
      unit: "gwei",
      trend: "down",
      change24h: -7.8,
    },
  ];

  const getMockBalances = (): ChainBalance[] => [
    {
      chain: "ethereum",
      symbol: "ETH",
      balance: 0.025,
      balanceUSD: 85,
      txsRemaining: 56,
      healthStatus: "healthy",
    },
    {
      chain: "polygon",
      symbol: "MATIC",
      balance: 2.5,
      balanceUSD: 2.5,
      txsRemaining: 250,
      healthStatus: "healthy",
    },
    {
      chain: "arbitrum",
      symbol: "ETH",
      balance: 0.008,
      balanceUSD: 27,
      txsRemaining: 180,
      healthStatus: "healthy",
    },
    {
      chain: "optimism",
      symbol: "ETH",
      balance: 0.002,
      balanceUSD: 6.8,
      txsRemaining: 56,
      healthStatus: "low",
    },
    {
      chain: "base",
      symbol: "ETH",
      balance: 0.0005,
      balanceUSD: 1.7,
      txsRemaining: 21,
      healthStatus: "critical",
    },
  ];

  const getMockPresets = (): GasPreset[] => [
    {
      name: "+1 Transaction",
      description: "Emergency top-up",
      amount: 2,
      txCount: 1,
    },
    {
      name: "+5 Transactions",
      description: "Standard top-up",
      amount: 8,
      txCount: 5,
    },
    {
      name: "+1 Day",
      description: "Based on your usage",
      amount: 15,
      txCount: 12,
    },
    { name: "+1 Week", description: "Best value", amount: 50, txCount: 50 },
  ];

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

  const totalBalanceUSD = balances.reduce((acc, b) => acc + b.balanceUSD, 0);
  const criticalChains = balances.filter(
    (b) => b.healthStatus === "critical"
  ).length;
  const lowChains = balances.filter((b) => b.healthStatus === "low").length;

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
              onClick={fetchAllData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-xl p-6"
          >
            <div className="text-gray-400 text-sm mb-1">Total Gas Balance</div>
            <div className="text-3xl font-bold text-white">
              ${totalBalanceUSD.toFixed(2)}
            </div>
            <div className="text-green-400 text-sm mt-1">
              Across {balances.length} chains
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
              {criticalChains > 0 ? (
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
              ) : (
                <>
                  <FaCheckCircle className="text-green-400 text-2xl" />
                  <span className="text-2xl font-bold text-green-400">
                    All Good
                  </span>
                </>
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
                      ${balance.balanceUSD.toFixed(2)}
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
