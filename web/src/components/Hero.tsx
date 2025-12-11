import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FaExchangeAlt, FaRocket, FaTelegram } from "react-icons/fa";
import octaneAPI from "../services/api";
import CoinIcon from "./CoinIcon";

export default function Hero() {
  const { data: botStatus } = useQuery({
    queryKey: ["botStatus"],
    queryFn: octaneAPI.getBotStatus,
    refetchInterval: 30000,
    retry: false,
  });

  const scrollToSwap = () => {
    document
      .getElementById("swap-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Real coin icons from SideShift API
  const floatingCoins = [
    { apiCode: "eth-ethereum", delay: 0 },
    { apiCode: "eth-base", delay: 0.2 },
    { apiCode: "eth-arbitrum", delay: 0.4 },
    { apiCode: "pol-polygon", delay: 0.6 },
    { apiCode: "eth-optimism", delay: 0.8 },
    { apiCode: "avax-avalanche", delay: 1 },
    { apiCode: "bnb-bsc", delay: 1.2 },
    { apiCode: "sol-solana", delay: 1.4 },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 opacity-20">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-green-400 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="inline-block"
          >
            <FaRocket className="text-8xl text-green-400 mb-4 mx-auto" />
          </motion.div>
          <h1 className="text-6xl md:text-8xl font-bold mb-4 bg-gradient-to-r from-green-400 to-purple-500 text-transparent bg-clip-text">
            OctaneShift
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl md:text-3xl text-gray-300 mb-4"
        >
          Never Get Stuck Without Gas Again
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto"
        >
          Gas Autopilot for Web3. Monitor your wallets, get smart alerts, and
          attach gas refills to any swap.
        </motion.p>

        {/* Key Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          {["🚀 Gas-on-Arrival", "📊 Smart Alerts", "⚡ One Dashboard"].map(
            (benefit, i) => (
              <span
                key={i}
                className="bg-gray-800/50 border border-gray-700 px-4 py-2 rounded-full text-gray-300 text-sm"
              >
                {benefit}
              </span>
            )
          )}
        </motion.div>

        <div className="flex justify-center gap-6 mb-12">
          {floatingCoins.map(({ apiCode, delay }, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={{
                opacity: 1,
                y: [0, -20, 0],
              }}
              transition={{
                opacity: { delay: delay, duration: 0.5 },
                y: {
                  delay: delay + 0.5,
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
              className="hidden md:block"
            >
              <CoinIcon apiCode={apiCode} size={48} />
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.a
            href={import.meta.env.VITE_TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-3 bg-gradient-to-r from-green-500 to-purple-600 text-white font-bold text-xl px-12 py-5 rounded-full shadow-lg hover:shadow-green-500/50 transition-all"
          >
            <FaTelegram className="text-3xl" />
            Launch Bot
          </motion.a>

          <motion.button
            onClick={scrollToSwap}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Scroll to swap section"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xl px-12 py-5 rounded-full shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            <FaExchangeAlt className="text-3xl" />
            Start Swapping
          </motion.button>
        </div>

        {botStatus?.data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-12 flex flex-wrap gap-8 justify-center"
          >
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl px-8 py-4 border border-gray-700">
              <p className="text-3xl font-bold text-green-400">
                {botStatus.data.bot_running ? "🟢 Online" : "🔴 Offline"}
              </p>
              <p className="text-gray-400 mt-1">Bot Status</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
