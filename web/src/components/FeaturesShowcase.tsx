import { motion } from "framer-motion";
import {
  FaBolt,
  FaChartBar,
  FaClock,
  FaGift,
  FaLayerGroup,
  FaLink,
} from "react-icons/fa";
import { Link } from "react-router-dom";

const features = [
  {
    icon: FaBolt,
    title: "Gas Presets",
    description: "Quick presets for minting, DeFi, gaming, and more",
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
    icon: FaClock,
    title: "Proof & Timeline",
    description: "Track your transactions with detailed timelines",
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
            Wave 2 Features
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Explore our latest features designed to make gas management
            effortless
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div
                  className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${feature.color} mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="text-3xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-green-400 group-hover:to-blue-500 transition-all">
                  {feature.title}
                </h3>
                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                  {feature.description}
                </p>
                <div className="mt-4 text-blue-400 group-hover:text-blue-300 font-semibold flex items-center gap-2">
                  Explore
                  <svg
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
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
          <div className="inline-flex items-center gap-2 bg-blue-900/20 border border-blue-700/50 rounded-full px-6 py-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-blue-400 font-medium">
              All features are live and ready to use!
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
