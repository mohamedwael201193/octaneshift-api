import { motion } from "framer-motion";
import {
  FaBolt,
  FaChartBar,
  FaCrown,
  FaGasPump,
  FaGift,
  FaLayerGroup,
  FaLink,
  FaRocket,
} from "react-icons/fa";
import { Link } from "react-router-dom";

const features = [
  {
    icon: FaGasPump,
    title: "Gas-on-Arrival",
    description: "Never land on a chain without gas. Attach gas to any swap.",
    link: "#swap-section",
    color: "from-purple-500 to-pink-500",
    badge: "NEW",
  },
  {
    icon: FaBolt,
    title: "Smart Presets",
    description: "Live gas prices power intelligent preset amounts",
    link: "/presets",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: FaLayerGroup,
    title: "Batch Top-Up",
    description: "Top up multiple wallets at once with CSV support",
    link: "/batch",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: FaGift,
    title: "Gas Gifts",
    description: "Send shareable gas gift links to friends",
    link: "/gift/create",
    color: "from-pink-500 to-purple-500",
  },
  {
    icon: FaCrown,
    title: "Loyalty Rewards",
    description: "Earn free top-ups and tier upgrades as you shift",
    link: "/status",
    color: "from-amber-500 to-yellow-500",
    badge: "NEW",
  },
  {
    icon: FaChartBar,
    title: "Status Dashboard",
    description: "Real-time metrics and system health",
    link: "/status",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: FaLink,
    title: "Deep Link Alerts",
    description: "Smart notifications with one-click top-ups",
    link: "#alerts",
    color: "from-indigo-500 to-blue-500",
  },
  {
    icon: FaRocket,
    title: "Proof & Tracking",
    description: "Full transaction proof with explorer links",
    link: "#proof",
    color: "from-red-500 to-pink-500",
  },
];

export default function FeaturesShowcase() {
  return (
    <div className="py-20 px-4 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
            Everything You Need
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Never get stuck without gas again. OctaneShift watches your wallets
            and attaches gas refills to your swaps.
          </p>
        </motion.div>

        {/* Why OctaneShift - Before/After */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 grid md:grid-cols-2 gap-6"
        >
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
            <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">❌</span> Before OctaneShift
            </h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>• Bridge to Base, forget gas, stuck</li>
              <li>• Deposit to CEX, buy ETH, withdraw, wait 10 min</li>
              <li>• 4 steps, 2 fees, frustration</li>
            </ul>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6">
            <h3 className="text-green-400 font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">✅</span> After OctaneShift
            </h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>• One swap from USDT → gas on Base in ~1 minute</li>
              <li>• No account, no CEX, no waiting</li>
              <li>• Land ready to trade with gas-on-arrival</li>
            </ul>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                to={feature.link}
                className="block h-full bg-gray-800/50 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 hover:bg-gray-800/70 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="text-2xl text-white" />
                  </div>
                  {feature.badge && (
                    <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full">
                      {feature.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-green-400 group-hover:to-blue-500 transition-all">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">
                  {feature.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-green-900/20 border border-green-700/50 rounded-full px-6 py-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 font-medium">
              Powered by SideShift.ai • 200+ assets • 100% non-custodial
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
