import { motion } from 'framer-motion';
import { SUPPORTED_CHAINS } from '../config/chains';

export default function SupportedChains() {
  return (
    <div className="py-24 px-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-green-500 text-transparent bg-clip-text">
            Supported Chains
          </h2>
          <p className="text-xl text-gray-400">Top up gas on all major networks</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {SUPPORTED_CHAINS.map((chain, index) => (
            <motion.div
              key={chain.id}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05, y: -10 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl blur-xl"
                style={{
                  background: `linear-gradient(135deg, ${chain.color}40, ${chain.color}20)`
                }}
              />
              <div className="relative bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700 group-hover:border-gray-600 transition-all">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${chain.color}20`,
                    border: `2px solid ${chain.color}`
                  }}
                >
                  <chain.icon className="text-4xl" style={{ color: chain.color }} />
                </motion.div>

                <h3 className="text-2xl font-bold mb-2 text-white text-center">{chain.name}</h3>
                <p className="text-gray-400 text-center mb-4">{chain.symbol}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between bg-gray-900/50 rounded-lg px-4 py-2">
                    <span className="text-gray-400">Min Amount:</span>
                    <span className="text-white font-semibold">{chain.minAmount} {chain.symbol}</span>
                  </div>
                  <div className="flex justify-between bg-gray-900/50 rounded-lg px-4 py-2">
                    <span className="text-gray-400">Max Amount:</span>
                    <span className="text-white font-semibold">{chain.maxAmount} {chain.symbol}</span>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <span className="inline-block bg-green-500/20 text-green-400 px-4 py-1 rounded-full text-xs font-semibold">
                    Live
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
