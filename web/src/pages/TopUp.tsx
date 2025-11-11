import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "../components/Footer";
import SwapInterface from "../components/SwapInterface";

export default function TopUp() {
  const [searchParams] = useSearchParams();

  const chain = searchParams.get("chain");
  const amount = searchParams.get("amount");
  const address = searchParams.get("address");
  const preset = searchParams.get("preset");
  const alertId = searchParams.get("alertId");
  const mode = searchParams.get("mode");

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            Gas Top-Up
          </h1>
          {preset && (
            <p className="text-gray-400">
              Using preset:{" "}
              <span className="text-blue-400 font-semibold capitalize">
                {preset.replace("-", " ")}
              </span>
            </p>
          )}
          {alertId && (
            <div className="mt-4 inline-flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/50 rounded-full px-4 py-2">
              <span className="text-yellow-400">⚠️</span>
              <span className="text-yellow-300">
                Responding to low gas alert
              </span>
            </div>
          )}
          {mode === "gift" && (
            <div className="mt-4 inline-flex items-center gap-2 bg-pink-900/20 border border-pink-700/50 rounded-full px-4 py-2">
              <span className="text-pink-400">🎁</span>
              <span className="text-pink-300">Claiming gas gift</span>
            </div>
          )}
        </div>

        {/* Swap Interface with pre-filled values */}
        <div id="swap-section">
          <SwapInterface
            prefilledChain={chain || undefined}
            prefilledAmount={amount || undefined}
            prefilledAddress={address || undefined}
          />
        </div>

        {/* Info Section */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">
              💡 Quick Tips
            </h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Gas will be delivered to your wallet in minutes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>You can track your order status after confirmation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Need help? Contact us via Telegram bot</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
