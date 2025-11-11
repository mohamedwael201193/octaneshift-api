import { motion } from "framer-motion";
import { ArrowRight, Info, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Preset {
  id: string;
  name: string;
  chain: string;
  amount: string;
  description: string;
  rationale: string;
  useCase: string;
  icon: string;
  displayAmount: string;
}

const presets: Preset[] = [
  {
    id: "mint-base",
    name: "Mint on Base",
    chain: "base",
    amount: "5",
    description: "Perfect for NFT minting on Base",
    rationale: "Base offers extremely low gas fees (~$0.01-0.05 per tx)",
    useCase: "~20-50 NFT mints",
    icon: "🎨",
    displayAmount: "5 USDT",
  },
  {
    id: "defi-arbitrum",
    name: "DeFi on Arbitrum",
    chain: "arbitrum",
    amount: "10",
    description: "Swap, stake, and farm on Arbitrum",
    rationale: "Arbitrum L2 reduces costs by 90% vs Ethereum mainnet",
    useCase: "~10-30 DeFi transactions",
    icon: "💰",
    displayAmount: "10 USDT",
  },
  {
    id: "gaming-polygon",
    name: "Gaming on Polygon",
    chain: "polygon",
    amount: "5",
    description: "Play blockchain games on Polygon",
    rationale: "Polygon has ultra-low fees ideal for frequent game actions",
    useCase: "~100-500 game transactions",
    icon: "🎮",
    displayAmount: "5 USDT",
  },
  {
    id: "social-optimism",
    name: "Social on Optimism",
    chain: "optimism",
    amount: "5",
    description: "Post, tip, and interact on Farcaster/Lens",
    rationale: "Optimism powers social dApps with low-cost interactions",
    useCase: "~30-100 social posts",
    icon: "💬",
    displayAmount: "5 USDT",
  },
  {
    id: "daily-ethereum",
    name: "Daily Ethereum",
    chain: "ethereum",
    amount: "20",
    description: "General Ethereum mainnet usage",
    rationale: "Standard amount for daily Ethereum transactions",
    useCase: "~5-15 transactions",
    icon: "⚡",
    displayAmount: "20 USDT",
  },
  {
    id: "trial-any",
    name: "Trial Amount",
    chain: "base",
    amount: "5",
    description: "Just trying things out",
    rationale: "Minimal amount to test wallet and dApps",
    useCase: "~5-10 test transactions",
    icon: "🧪",
    displayAmount: "5 USDT",
  },
];

export default function Presets() {
  const navigate = useNavigate();

  const handleSelectPreset = (preset: Preset) => {
    // Navigate to top-up page with preset values
    const params = new URLSearchParams({
      chain: preset.chain,
      amount: preset.amount,
      preset: preset.id,
    });

    navigate(`/topup?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-4 rounded-2xl">
              <Zap className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Gas Top-Up Presets
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Choose from our optimized presets tailored for different use cases.
            Each preset is designed to give you the right amount of gas for your
            needs.
          </p>
        </motion.div>

        {/* Presets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presets.map((preset, index) => (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all cursor-pointer group"
              onClick={() => handleSelectPreset(preset)}
            >
              {/* Icon & Name */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{preset.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      {preset.name}
                    </h3>
                    <span className="text-sm text-gray-500 capitalize">
                      {preset.chain}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
              </div>

              {/* Amount Badge */}
              <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-lg p-3 mb-4">
                <div className="text-xs text-blue-400 mb-1">
                  Recommended Amount
                </div>
                <div className="text-2xl font-bold text-white">
                  {preset.displayAmount}
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm mb-4">{preset.description}</p>

              {/* Use Case */}
              <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
                <div className="text-xs text-gray-500 mb-1">
                  Estimated Usage
                </div>
                <div className="text-sm text-gray-300">{preset.useCase}</div>
              </div>

              {/* Rationale Tooltip */}
              <div className="flex items-start gap-2 text-xs text-gray-500">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{preset.rationale}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Custom Amount CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center"
        >
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600 rounded-xl p-8">
            <h2 className="text-xl font-semibold text-white mb-2">
              Need a custom amount?
            </h2>
            <p className="text-gray-400 mb-4">
              These are just suggestions. You can specify any amount on the
              top-up page.
            </p>
            <button
              onClick={() => navigate("/topup")}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all"
            >
              Custom Top-Up
            </button>
          </div>
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 bg-blue-900/20 border border-blue-700/50 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-blue-400 mb-3">
            💡 Pro Tips
          </h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span>
                <strong>L2 networks</strong> (Base, Arbitrum, Optimism, Polygon)
                offer 10-100x cheaper gas than Ethereum mainnet
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span>
                <strong>Gas prices vary</strong> by time of day and network
                congestion
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-1">•</span>
              <span>
                <strong>Monitor your balance</strong> with our alerts to never
                run out of gas
              </span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
