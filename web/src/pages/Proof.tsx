import axios from "axios";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

interface ShiftData {
  id: string;
  status: string;
  createdAt: string;
  depositCoin: string;
  depositNetwork: string;
  depositAddress: string;
  depositAmount?: string;
  depositMin: string;
  depositMax: string;
  settleCoin: string;
  settleNetwork: string;
  settleAddress: string;
  settleAmount?: string;
  expiresAt?: string;
  depositHash?: string;
  settleHash?: string;
  refundAddress?: string;
  depositMemo?: string;
  settleMemo?: string;
  rate?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Explorer URLs for different networks
const EXPLORERS: Record<string, string> = {
  ethereum: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  avalanche: "https://snowtrace.io/tx/",
  tron: "https://tronscan.org/#/transaction/",
  bsc: "https://bscscan.com/tx/",
};

export default function Proof() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [shift, setShift] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<string>("");

  useEffect(() => {
    const fetchShift = async () => {
      if (!shiftId) {
        setError("No shift ID provided");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/shifts/${shiftId}`
        );
        if (response.data.success) {
          setShift(response.data.data);
        } else {
          setError("Shift not found");
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load shift details");
      } finally {
        setLoading(false);
      }
    };

    fetchShift();
    // Poll for updates every 10 seconds if pending
    const interval = setInterval(() => {
      if (shift?.status === "pending" || shift?.status === "processing") {
        fetchShift();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [shiftId, shift?.status]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(""), 2000);
  };

  const getExplorerUrl = (network: string, hash: string) => {
    const baseUrl = EXPLORERS[network.toLowerCase()];
    return baseUrl ? `${baseUrl}${hash}` : null;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "complete":
      case "settled":
        return "text-green-400 bg-green-900/20 border-green-700/50";
      case "pending":
      case "processing":
      case "waiting":
        return "text-yellow-400 bg-yellow-900/20 border-yellow-700/50";
      case "failed":
      case "expired":
      case "refunded":
        return "text-red-400 bg-red-900/20 border-red-700/50";
      default:
        return "text-gray-400 bg-gray-900/20 border-gray-700/50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "complete":
      case "settled":
        return <CheckCircle className="w-5 h-5" />;
      case "pending":
      case "processing":
      case "waiting":
        return <Clock className="w-5 h-5 animate-pulse" />;
      case "failed":
      case "expired":
      case "refunded":
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !shift) {
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
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Shift Proof
          </h1>
          <p className="text-gray-400">Transaction details and verification</p>
        </motion.div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">
                Shift Status
              </h2>
              <p className="text-gray-400 text-sm">ID: {shift.id}</p>
            </div>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full border ${getStatusColor(
                shift.status
              )}`}
            >
              {getStatusIcon(shift.status)}
              <span className="font-semibold capitalize">{shift.status}</span>
            </div>
          </div>

          {shift.rate && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Exchange Rate:</span>
                <span className="text-blue-400 font-semibold">
                  {shift.rate}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Deposit Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Deposit (You Send)
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Coin:</span>
              <span className="text-white font-semibold">
                {shift.depositCoin.toUpperCase()} on {shift.depositNetwork}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Address:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm">
                  {shift.depositAddress.slice(0, 10)}...
                  {shift.depositAddress.slice(-8)}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(shift.depositAddress, "Deposit Address")
                  }
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copied === "Deposit Address" ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {shift.depositAmount && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white font-semibold">
                  {shift.depositAmount} {shift.depositCoin.toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Min - Max:</span>
              <span className="text-gray-300 text-sm">
                {shift.depositMin} - {shift.depositMax}
              </span>
            </div>

            {shift.depositMemo && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Memo/Tag:</span>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 font-mono text-sm">
                    {shift.depositMemo}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(shift.depositMemo!, "Deposit Memo")
                    }
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {copied === "Deposit Memo" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {shift.depositHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Transaction:</span>
                <a
                  href={
                    getExplorerUrl(shift.depositNetwork, shift.depositHash) ||
                    "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span className="text-sm">View on Explorer</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </motion.div>

        {/* Settlement Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5" />
            Settlement (You Receive)
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Coin:</span>
              <span className="text-white font-semibold">
                {shift.settleCoin.toUpperCase()} on {shift.settleNetwork}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Address:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm">
                  {shift.settleAddress.slice(0, 10)}...
                  {shift.settleAddress.slice(-8)}
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(shift.settleAddress, "Settle Address")
                  }
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copied === "Settle Address" ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {shift.settleAmount && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white font-semibold">
                  {shift.settleAmount} {shift.settleCoin.toUpperCase()}
                </span>
              </div>
            )}

            {shift.settleMemo && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Memo/Tag:</span>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 font-mono text-sm">
                    {shift.settleMemo}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(shift.settleMemo!, "Settle Memo")
                    }
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {copied === "Settle Memo" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {shift.settleHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Transaction:</span>
                <a
                  href={
                    getExplorerUrl(shift.settleNetwork, shift.settleHash) || "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span className="text-sm">View on Explorer</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-300 mb-4">
            Additional Information
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Created:</span>
              <span className="text-gray-300 text-sm">
                {new Date(shift.createdAt).toLocaleString()}
              </span>
            </div>

            {shift.expiresAt && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Expires:</span>
                <span className="text-gray-300 text-sm">
                  {new Date(shift.expiresAt).toLocaleString()}
                </span>
              </div>
            )}

            {shift.refundAddress && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Refund Address:</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-mono text-sm">
                    {shift.refundAddress.slice(0, 10)}...
                    {shift.refundAddress.slice(-8)}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(shift.refundAddress!, "Refund Address")
                    }
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {copied === "Refund Address" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4"
        >
          <button
            onClick={() => navigate("/")}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Create New Shift
          </button>
          <button
            onClick={() => navigate("/status")}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            View Status Dashboard
          </button>
        </motion.div>
      </div>
    </div>
  );
}
