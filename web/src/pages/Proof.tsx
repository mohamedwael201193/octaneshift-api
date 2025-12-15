import axios from "axios";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import QRCode from "qrcode";
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
  networkFee?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Coin icons mapping
const COIN_ICONS: Record<string, string> = {
  usdc: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
  usdt: "https://cryptologos.cc/logos/tether-usdt-logo.png",
  eth: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  btc: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  pol: "https://cryptologos.cc/logos/polygon-matic-logo.png",
  matic: "https://cryptologos.cc/logos/polygon-matic-logo.png",
  avax: "https://cryptologos.cc/logos/avalanche-avax-logo.png",
  bnb: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
  sol: "https://cryptologos.cc/logos/solana-sol-logo.png",
  xrp: "https://cryptologos.cc/logos/xrp-xrp-logo.png",
  dai: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png",
  wbtc: "https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png",
  link: "https://cryptologos.cc/logos/chainlink-link-logo.png",
  uni: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
  aave: "https://cryptologos.cc/logos/aave-aave-logo.png",
};

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

type ShiftStep = 1 | 2 | 3;

export default function Proof() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [shift, setShift] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // Determine current step based on status
  const getCurrentStep = (status: string): ShiftStep => {
    switch (status.toLowerCase()) {
      case "waiting":
        return 2;
      case "pending":
      case "processing":
      case "settling":
        return 3;
      case "settled":
      case "complete":
        return 3;
      default:
        return 2;
    }
  };

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
          // Generate QR code
          const qr = await QRCode.toDataURL(response.data.data.depositAddress, {
            width: 200,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          setQrDataUrl(qr);
        } else {
          setError("Shift not found");
        }
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(
          axiosError.response?.data?.error || "Failed to load shift details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchShift();
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      if (
        shift?.status === "waiting" ||
        shift?.status === "pending" ||
        shift?.status === "processing"
      ) {
        fetchShift();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [shiftId, shift?.status]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getExplorerUrl = (network: string, hash: string) => {
    const baseUrl = EXPLORERS[network.toLowerCase()];
    return baseUrl ? `${baseUrl}${hash}` : null;
  };

  const getCoinIcon = (coin: string) => {
    return COIN_ICONS[coin.toLowerCase()] || COIN_ICONS.eth;
  };

  const getStatusMessage = () => {
    if (!shift) return "";
    switch (shift.status.toLowerCase()) {
      case "waiting":
        return `Waiting for you to send ${shift.depositCoin.toUpperCase()} .`;
      case "pending":
        return "Deposit received, processing...";
      case "processing":
        return "Processing your swap...";
      case "settling":
        return `Sending ${shift.settleCoin.toUpperCase()} to your address...`;
      case "settled":
      case "complete":
        return "Swap completed successfully!";
      case "expired":
        return "This shift has expired.";
      case "refunded":
        return "This shift was refunded.";
      default:
        return "Processing...";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error || !shift) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center"
        >
          <div className="bg-red-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            Go Home
          </button>
        </motion.div>
      </div>
    );
  }

  const currentStep = getCurrentStep(shift.status);
  const isComplete = shift.status === "settled" || shift.status === "complete";
  const isWaiting = shift.status === "waiting";

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
        >
          {/* Step Indicator */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
              {/* Step 1 */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500">STEP 1:</span>
                <span className="text-gray-400">CHOOSE COIN PAIR</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />

              {/* Step 2 */}
              <div className="flex items-center gap-2">
                <span
                  className={
                    currentStep >= 2 ? "text-yellow-500" : "text-gray-500"
                  }
                >
                  STEP 2:
                </span>
                <img
                  src={getCoinIcon(shift.depositCoin)}
                  alt={shift.depositCoin}
                  className="w-5 h-5 rounded-full"
                />
                <span
                  className={
                    currentStep >= 2 ? "text-yellow-400" : "text-gray-400"
                  }
                >
                  SEND {shift.depositCoin.toUpperCase()}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />

              {/* Step 3 */}
              <div className="flex items-center gap-2">
                <span
                  className={
                    currentStep >= 3 ? "text-yellow-500" : "text-gray-500"
                  }
                >
                  STEP 3:
                </span>
                <img
                  src={getCoinIcon(shift.settleCoin)}
                  alt={shift.settleCoin}
                  className="w-5 h-5 rounded-full"
                />
                <span
                  className={
                    currentStep >= 3 ? "text-yellow-400" : "text-gray-400"
                  }
                >
                  RECEIVE {shift.settleCoin.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="px-6 py-8">
            <h1 className="text-3xl font-light text-center mb-8 tracking-wide">
              {getStatusMessage()}
            </h1>

            {/* Main Content - QR and Details */}
            {isWaiting && (
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* QR Code */}
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <div className="relative bg-white rounded-2xl p-4 w-[220px] h-[220px]">
                    {qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="Deposit QR Code"
                        className="w-full h-full"
                      />
                    )}
                    {/* Coin logo overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white rounded-lg p-1 shadow-lg">
                        <img
                          src={getCoinIcon(shift.depositCoin)}
                          alt={shift.depositCoin}
                          className="w-10 h-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deposit Details */}
                <div className="flex-1 space-y-5 w-full">
                  {/* Min/Max */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm tracking-wider flex items-center gap-1">
                        MINIMUM
                        <span className="w-4 h-4 rounded-full border border-gray-600 text-[10px] flex items-center justify-center cursor-help">
                          ?
                        </span>
                      </span>
                      <span className="font-mono text-white">
                        {shift.depositMin} {shift.depositCoin.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm tracking-wider flex items-center gap-1">
                        MAXIMUM
                        <span className="w-4 h-4 rounded-full border border-gray-600 text-[10px] flex items-center justify-center cursor-help">
                          ?
                        </span>
                      </span>
                      <span className="font-mono text-white">
                        {shift.depositMax} {shift.depositCoin.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Deposit Address */}
                  <div className="pt-4">
                    <div className="text-gray-500 text-sm tracking-wider mb-2">
                      TO THE {shift.depositCoin.toUpperCase()} (
                      {shift.depositNetwork.toUpperCase()}) ADDRESS
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white text-sm break-all">
                        {shift.depositAddress}
                      </span>
                      <button
                        onClick={() => copyToClipboard(shift.depositAddress)}
                        className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                      >
                        {copied ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4">
                    <button
                      onClick={() => copyToClipboard(shift.depositAddress)}
                      className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      COPY ADDRESS
                    </button>
                  </div>

                  {/* Rate and Fee Info */}
                  <div className="space-y-3 pt-4 border-t border-gray-800">
                    {shift.rate && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm tracking-wider flex items-center gap-1">
                          RATE
                          <ExternalLink className="w-3 h-3" />
                        </span>
                        <span className="text-white">
                          1 {shift.depositCoin.toUpperCase()} ≈ {shift.rate}{" "}
                          {shift.settleCoin.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm tracking-wider flex items-center gap-1">
                        NETWORK FEES
                        <span className="w-4 h-4 rounded-full border border-gray-600 text-[10px] flex items-center justify-center cursor-help">
                          ?
                        </span>
                      </span>
                      <span className="text-white">
                        {shift.networkFee || "Included"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm tracking-wider">
                        RECEIVING ADDRESS
                      </span>
                      <span className="font-mono text-white text-sm">
                        {shift.settleAddress.slice(0, 6)}...
                        {shift.settleAddress.slice(-4)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Processing/Complete State */}
            {!isWaiting && (
              <div className="text-center py-8">
                {isComplete ? (
                  <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <p className="text-gray-400">
                      Your {shift.settleAmount} {shift.settleCoin.toUpperCase()}{" "}
                      has been sent!
                    </p>
                    {shift.settleHash && (
                      <a
                        href={
                          getExplorerUrl(
                            shift.settleNetwork,
                            shift.settleHash
                          ) || "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                      >
                        View transaction
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ) : shift.status === "expired" ? (
                  <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                      <XCircle className="w-10 h-10 text-red-400" />
                    </div>
                    <p className="text-gray-400">This shift has expired.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <Clock className="w-10 h-10 text-yellow-400 animate-pulse" />
                    </div>
                    <p className="text-gray-400">Processing your swap...</p>
                    <div className="flex justify-center gap-8 text-sm">
                      <div>
                        <div className="text-gray-500">Deposit</div>
                        <div className="text-white">
                          {shift.depositAmount || shift.depositMin}{" "}
                          {shift.depositCoin.toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">You'll receive</div>
                        <div className="text-white">
                          ~{shift.settleAmount || "..."}{" "}
                          {shift.settleCoin.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shift ID Footer */}
          <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Shift ID:</span>
              <span className="font-mono text-gray-400">{shift.id}</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom Actions */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={() => navigate("/")}
            className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors border border-gray-700"
          >
            Create New Shift
          </button>
          <button
            onClick={() => navigate("/status")}
            className="flex-1 py-3 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-xl transition-colors"
          >
            View All Orders
          </button>
        </div>
      </div>
    </div>
  );
}
