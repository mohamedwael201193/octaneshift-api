import axios from "axios";
import { motion } from "framer-motion";
import { Check, Copy, Gift, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function GiftCreate() {
  const [formData, setFormData] = useState({
    chain: "eth",
    settleAmount: "",
    settleAddress: "",
    message: "",
    ttl: 30, // days
  });
  const [loading, setLoading] = useState(false);
  const [giftUrl, setGiftUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.settleAmount || !formData.settleAddress) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await axios.post(
        `${API_BASE_URL}/api/gifts`,
        {
          chain: formData.chain,
          settleAmount: formData.settleAmount,
          settleAddress: formData.settleAddress,
          message: formData.message || undefined,
          ttl: formData.ttl * 24, // Convert days to hours
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setGiftUrl(response.data.data.shareableUrl);
        toast.success("Gift link created!");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create gift link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(giftUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setGiftUrl("");
    setFormData({
      chain: "eth",
      settleAmount: "",
      settleAddress: "",
      message: "",
      ttl: 30,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-pink-600 to-purple-600 p-4 rounded-2xl">
              <Gift className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Create Gas Gift Link
          </h1>
          <p className="text-gray-400">
            Share gas with friends, teammates, or anyone who needs it
          </p>
        </motion.div>

        {!giftUrl ? (
          /* Creation Form */
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6"
          >
            {/* Chain Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Network *
              </label>
              <select
                value={formData.chain}
                onChange={(e) =>
                  setFormData({ ...formData, chain: e.target.value })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="eth">Ethereum</option>
                <option value="base">Base</option>
                <option value="pol">Polygon</option>
                <option value="arb">Arbitrum</option>
                <option value="op">Optimism</option>
                <option value="avax">Avalanche</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gas Amount (ETH/Native Token) *
              </label>
              <input
                type="text"
                placeholder="0.01"
                value={formData.settleAmount}
                onChange={(e) =>
                  setFormData({ ...formData, settleAmount: e.target.value })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-gray-500 text-xs mt-1">
                Enough for ~10-50 transactions depending on network
              </p>
            </div>

            {/* Recipient Address */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recipient Address *
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={formData.settleAddress}
                onChange={(e) =>
                  setFormData({ ...formData, settleAddress: e.target.value })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Message (Optional)
              </label>
              <textarea
                placeholder="Happy holidays! Here's some gas for your next mint 🎁"
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Expiration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Link Expiration
              </label>
              <select
                value={formData.ttl}
                onChange={(e) =>
                  setFormData({ ...formData, ttl: parseInt(e.target.value) })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Gift Link...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  Create Gift Link
                </>
              )}
            </button>
          </motion.form>
        ) : (
          /* Success View */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 border border-pink-700/50 rounded-xl p-8 text-center"
          >
            <div className="bg-green-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Gift Link Created!
            </h2>
            <p className="text-gray-400 mb-6">
              Share this link with your recipient
            </p>

            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-400 mb-2">Shareable Link</div>
              <div className="text-blue-400 font-mono text-sm break-all mb-4">
                {giftUrl}
              </div>
              <button
                onClick={handleCopy}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleReset}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Create Another Gift
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
