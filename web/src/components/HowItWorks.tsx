import { motion } from 'framer-motion';
import { FaNetworkWired, FaExchangeAlt, FaBolt } from 'react-icons/fa';
import { useState } from 'react';

const steps = [
  {
    icon: FaNetworkWired,
    title: 'Choose Your Chain',
    description: 'Select from Ethereum, Base, Arbitrum, Polygon, Optimism, or Avalanche',
    details: 'Support for all major EVM chains with instant availability',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: FaExchangeAlt,
    title: 'Send Any Crypto',
    description: 'Pay with USDT, USDC, ETH, or BTC from any supported network',
    details: 'Powered by SideShift.ai for the best rates',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: FaBolt,
    title: 'Receive Gas Instantly',
    description: 'Get native gas tokens delivered to your wallet in minutes',
    details: 'Automated processing with real-time tracking',
    color: 'from-green-500 to-emerald-500'
  }
];

export default function HowItWorks() {
  const [flipped, setFlipped] = useState<number | null>(null);

  return (
    <div className="py-24 px-4 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-purple-500 text-transparent bg-clip-text">
            How It Works
          </h2>
          <p className="text-xl text-gray-400">Simple, fast, and secure gas top-ups</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              onHoverStart={() => setFlipped(index)}
              onHoverEnd={() => setFlipped(null)}
              className="relative h-80"
              style={{ perspective: '1000px' }}
            >
              <motion.div
                animate={{ rotateY: flipped === index ? 180 : 0 }}
                transition={{ duration: 0.6 }}
                className="relative w-full h-full"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div
                  className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <motion.div
                    animate={{
                      scale: flipped === index ? [1, 1.2, 1] : 1,
                    }}
                    transition={{ duration: 0.3 }}
                    className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center`}
                  >
                    <step.icon className="text-4xl text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-4 text-white">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                  <div className="absolute top-4 right-4 text-6xl font-bold text-gray-700/30">
                    {index + 1}
                  </div>
                </div>

                <div
                  className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-purple-500/20 backdrop-blur-xl rounded-3xl p-8 border border-green-500/50"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <div className="flex items-center justify-center h-full">
                    <p className="text-lg text-white text-center">{step.details}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
