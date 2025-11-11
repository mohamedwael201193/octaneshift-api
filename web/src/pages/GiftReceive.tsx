import axios from "axios";
import { motion } from "framer-motion";
import { AlertCircle, Clock, Gift, Loader2, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface GiftData {
  chain: string;
  settleAmount: string;
  settleAddress: string;
  message?: string;
  createdAt: string;
  expiresAt?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function GiftReceive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gift, setGift] = useState<GiftData | null>(null);
  const [error, setError] = useState<string>("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const fetchGift = async () => {
      if (!id) {
        setError("Invalid gift link");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API_BASE_URL}/api/gifts/${id}`);

        if (response.data.success) {
          setGift(response.data.data);
        }
      } catch (err: any) {
        if (err.response?.status === 410) {
          setExpired(true);
          setError("This gift link has expired");
        } else if (err.response?.status === 404) {
          setError("Gift not found");
        } else {
          setError(err.response?.data?.error || "Failed to load gift");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGift();
  }, [id]);

  const handleClaim = () => {
    if (!gift) return;

    // Navigate to top-up page with pre-filled data
    const params = new URLSearchParams({
      chain: gift.chain,
      address: gift.settleAddress,
      amount: gift.settleAmount,
      mode: "gift",
    });

    navigate(`/topup?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-gray-800 rounded-2xl border border-gray-700 p-8 text-center"
        >
          <div className="bg-red-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {expired ? "Gift Expired" : "Error"}
          </h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Go Home
          </button>
        </motion.div>
      </div>
    );
  }

  if (!gift) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* Gift Card */}
        <div className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 border border-pink-700/50 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="bg-white/10 backdrop-blur rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center"
            >
              <Gift className="w-12 h-12 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">
              You've Received Gas!
            </h1>
            <p className="text-pink-100">Someone sent you a gas gift 🎁</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {gift.message && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-900/50 rounded-lg p-4 mb-6 border border-gray-700"
              >
                <div className="text-sm text-gray-400 mb-2">Message</div>
                <p className="text-white italic">
                  &ldquo;{gift.message}&rdquo;
                </p>
              </motion.div>
            )}

            {/* Gift Details */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-4 mb-6"
            >
              <div className="flex items-center gap-3 text-gray-300">
                <MapPin className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="text-sm text-gray-400">Network</div>
                  <div className="font-semibold capitalize">{gift.chain}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-gray-300">
                <Gift className="w-5 h-5 text-pink-400" />
                <div>
                  <div className="text-sm text-gray-400">Amount</div>
                  <div className="font-bold text-xl text-white">
                    {gift.settleAmount} ETH
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">
                  Recipient Address
                </div>
                <div className="text-white font-mono text-xs break-all">
                  {gift.settleAddress}
                </div>
              </div>

              {gift.expiresAt && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>
                    Expires: {new Date(gift.expiresAt).toLocaleDateString()} at{" "}
                    {new Date(gift.expiresAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Claim Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={handleClaim}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-pink-500/50"
            >
              Claim Your Gas Gift
            </motion.button>

            <p className="text-gray-500 text-xs text-center mt-4">
              You'll be redirected to complete the top-up process
            </p>
          </div>
        </div>

        {/* Created Date */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-6 text-gray-500 text-sm"
        >
          Gift created on {new Date(gift.createdAt).toLocaleDateString()}
        </motion.div>
      </motion.div>
    </div>
  );
}
