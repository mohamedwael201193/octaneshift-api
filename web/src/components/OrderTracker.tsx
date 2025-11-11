import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FaSearch, FaSpinner, FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import octaneAPI from '../services/api';

export default function OrderTracker() {
  const [shiftId, setShiftId] = useState('');
  const [trackingId, setTrackingId] = useState('');

  const { data: shiftData, isLoading } = useQuery({
    queryKey: ['shift', trackingId],
    queryFn: () => octaneAPI.getShift(trackingId),
    enabled: !!trackingId,
    refetchInterval: trackingId ? 5000 : false,
    retry: false
  });

  const handleTrack = () => {
    if (!shiftId) {
      toast.error('Please enter a Shift ID');
      return;
    }
    setTrackingId(shiftId);
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      waiting: FaClock,
      pending: FaClock,
      processing: FaSpinner,
      settled: FaCheckCircle,
      refunded: FaExclamationTriangle
    };
    return icons[status] || FaClock;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      waiting: 'text-yellow-400',
      pending: 'text-blue-400',
      processing: 'text-purple-400',
      settled: 'text-green-400',
      refunded: 'text-red-400'
    };
    return colors[status] || 'text-gray-400';
  };

  const getStatusBgColor = (status: string) => {
    const colors: Record<string, string> = {
      waiting: 'from-yellow-500/20 to-yellow-600/10',
      pending: 'from-blue-500/20 to-blue-600/10',
      processing: 'from-purple-500/20 to-purple-600/10',
      settled: 'from-green-500/20 to-green-600/10',
      refunded: 'from-red-500/20 to-red-600/10'
    };
    return colors[status] || 'from-gray-500/20 to-gray-600/10';
  };

  return (
    <div id="tracker-section" className="py-24 px-4 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-green-500 text-transparent bg-clip-text">
            Track Your Order
          </h2>
          <p className="text-xl text-gray-400">Enter your Shift ID to check status</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700 shadow-2xl"
        >
          <div className="flex gap-4 mb-8">
            <input
              type="text"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              placeholder="Enter Shift ID (e.g., abc123def456)"
              className="flex-1 bg-gray-900/70 border border-gray-600 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
              onKeyPress={(e) => e.key === 'Enter' && handleTrack()}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTrack}
              disabled={isLoading}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-green-500/50 transition-all flex items-center gap-2"
            >
              {isLoading ? <FaSpinner className="animate-spin" /> : <FaSearch />}
              {isLoading ? 'Loading...' : 'Track'}
            </motion.button>
          </div>

          {shiftData?.data && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className={`bg-gradient-to-br ${getStatusBgColor(shiftData.data.status)} border border-gray-600 rounded-2xl p-6`}>
                <h3 className="font-bold text-white mb-4 text-lg">Order Status</h3>
                <div className="flex items-center gap-4">
                  {(() => {
                    const StatusIcon = getStatusIcon(shiftData.data.status);
                    return (
                      <StatusIcon
                        className={`text-4xl ${getStatusColor(shiftData.data.status)} ${shiftData.data.status === 'processing' ? 'animate-spin' : ''
                          }`}
                      />
                    );
                  })()}
                  <p className={`text-3xl font-bold ${getStatusColor(shiftData.data.status)}`}>
                    {shiftData.data.status.toUpperCase()}
                  </p>
                </div>

                {shiftData.data.status === 'waiting' && (
                  <p className="mt-4 text-sm text-gray-300">
                    Waiting for your deposit to be confirmed on the blockchain
                  </p>
                )}
                {shiftData.data.status === 'processing' && (
                  <p className="mt-4 text-sm text-gray-300">
                    Processing your swap, this usually takes a few minutes
                  </p>
                )}
                {shiftData.data.status === 'settled' && (
                  <p className="mt-4 text-sm text-green-300">
                    Your gas tokens have been delivered successfully!
                  </p>
                )}
              </div>

              <div className="bg-gray-900/50 border border-gray-700 rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4 text-lg">Transaction Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">Order ID:</span>
                    <span className="font-mono text-white text-sm bg-gray-800 px-3 py-1 rounded">{shiftData.data.id}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">From:</span>
                    <span className="text-white font-semibold">
                      {shiftData.data.depositCoin} ({shiftData.data.depositNetwork})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">To:</span>
                    <span className="text-white font-semibold">
                      {shiftData.data.settleCoin} ({shiftData.data.settleNetwork})
                    </span>
                  </div>
                  {shiftData.data.depositAddress && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-gray-400 mb-2 text-sm">Deposit Address:</p>
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <p className="font-mono text-xs text-white break-all">{shiftData.data.depositAddress}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(shiftData.data.depositAddress);
                          toast.success('Address copied!');
                        }}
                        className="mt-3 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors text-sm"
                      >
                        Copy Address
                      </button>
                    </div>
                  )}
                  {shiftData.data.settleAddress && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-gray-400 mb-2 text-sm">Destination Address:</p>
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <p className="font-mono text-xs text-white break-all">{shiftData.data.settleAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center text-sm text-gray-400">
                <p>Refreshing automatically every 5 seconds</p>
              </div>
            </motion.div>
          )}

          {!shiftData && trackingId && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <FaExclamationTriangle className="text-5xl text-yellow-400 mx-auto mb-4" />
              <p className="text-gray-400">No order found with that ID</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
