import axios from "axios";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface AlertData {
  alertId: string;
  chain: string;
  address: string;
  currentBalance?: string;
  threshold?: string;
  settleAmount: string;
  type?: string;
  message?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function DeepLink() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"validating" | "valid" | "error">(
    "validating"
  );
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setError("Missing validation token");
        return;
      }

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/deeplink/validate`,
          {
            params: { token },
          }
        );

        if (response.data.success) {
          setAlertData(response.data.data);
          setStatus("valid");
        } else {
          setStatus("error");
          setError(response.data.error || "Invalid deep link");
        }
      } catch (err: any) {
        setStatus("error");
        if (err.response?.status === 410) {
          setError("This deep link has expired");
        } else if (err.response?.status === 403) {
          setError("Invalid or tampered deep link");
        } else {
          setError(err.response?.data?.error || "Failed to validate deep link");
        }
      }
    };

    validateToken();
  }, [searchParams]);

  const handleProceed = () => {
    if (!alertData) return;

    // Navigate to top-up page with pre-filled data
    const params = new URLSearchParams({
      chain: alertData.chain,
      address: alertData.address,
      amount: alertData.settleAmount,
      alertId: alertData.alertId,
    });

    navigate(`/topup?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <h1 className="text-2xl font-bold text-white">
            Gas Alert Notification
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            Validating your deep link...
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === "validating" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-400">Validating deep link...</p>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <div className="bg-red-900/20 rounded-full p-4 mb-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-red-400 mb-2">
                Validation Failed
              </h2>
              <p className="text-gray-400 text-center mb-6">{error}</p>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Return Home
              </button>
            </motion.div>
          )}

          {status === "valid" && alertData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-center justify-center mb-6">
                <div className="bg-green-900/20 rounded-full p-4">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
              </div>

              <h2 className="text-xl font-semibold text-white text-center mb-6">
                Low Gas Balance Detected
              </h2>

              {/* Alert Details */}
              <div className="space-y-3 mb-6">
                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Chain</div>
                  <div className="text-white font-medium">
                    {alertData.chain}
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Address</div>
                  <div className="text-white font-mono text-sm break-all">
                    {alertData.address}
                  </div>
                </div>

                {alertData.currentBalance && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">
                      Current Balance
                    </div>
                    <div className="text-red-400 font-medium">
                      {alertData.currentBalance}
                    </div>
                  </div>
                )}

                {alertData.threshold && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Threshold</div>
                    <div className="text-gray-300 font-medium">
                      {alertData.threshold}
                    </div>
                  </div>
                )}

                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                  <div className="text-sm text-blue-400 mb-1">
                    Recommended Top-Up
                  </div>
                  <div className="text-white font-bold text-lg">
                    {alertData.settleAmount}
                  </div>
                </div>

                {alertData.message && (
                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Message</div>
                    <div className="text-gray-300">{alertData.message}</div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceed}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2"
                >
                  Top Up Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
