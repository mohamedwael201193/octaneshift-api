/**
 * Gas-on-Arrival Component
 * Wave 3 Feature: Never land without gas
 */

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  FaBolt,
  FaCheckCircle,
  FaGasPump,
  FaInfoCircle,
  FaRocket,
  FaSpinner,
  FaToggleOff,
  FaToggleOn,
} from "react-icons/fa";
import octaneAPI from "../services/api";

interface GasOnArrivalToggleProps {
  destChain: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onAmountChange?: (amount: string) => void;
  className?: string;
}

interface GasRecommendation {
  recommended: number;
  symbol: string;
  usdValue: number;
  reason: string;
}

export default function GasOnArrivalToggle({
  destChain,
  enabled,
  onToggle,
  onAmountChange,
  className = "",
}: GasOnArrivalToggleProps) {
  const [customAmount, setCustomAmount] = useState<string>("");

  // Fetch gas recommendation for destination chain
  const { data: recommendation, isLoading } = useQuery({
    queryKey: ["gas-arrival-recommendation", destChain],
    queryFn: async () => {
      try {
        const response = await octaneAPI.getGasArrivalRecommendation(destChain);
        return response.data as GasRecommendation;
      } catch {
        // Return default if API fails
        return {
          recommended: 0.005,
          symbol: "ETH",
          usdValue: 11,
          reason: `Enough for ~5 transactions on ${destChain.toUpperCase()}`,
        };
      }
    },
    enabled: true,
  });

  const handleToggle = () => {
    const newEnabled = !enabled;
    onToggle(newEnabled);

    if (newEnabled && recommendation) {
      onAmountChange?.(recommendation.recommended.toString());
      toast.success(
        `Gas-on-arrival enabled: +${recommendation.recommended} ${recommendation.symbol}`
      );
    }
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    onAmountChange?.(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4 ${className}`}
    >
      {/* Toggle Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <FaGasPump className="text-purple-400 text-lg" />
          </div>
          <div>
            <h4 className="font-semibold text-white flex items-center gap-2">
              Gas-on-Arrival
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                NEW
              </span>
            </h4>
            <p className="text-xs text-gray-400">
              Never land on a chain without gas
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          className="text-3xl transition-transform hover:scale-110"
        >
          {enabled ? (
            <FaToggleOn className="text-green-400" />
          ) : (
            <FaToggleOff className="text-gray-500" />
          )}
        </button>
      </div>

      {/* Expanded content when enabled */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <FaSpinner className="animate-spin text-purple-400" />
                <span className="ml-2 text-gray-400">
                  Calculating optimal gas...
                </span>
              </div>
            ) : recommendation ? (
              <div className="mt-3 space-y-3">
                {/* Recommendation card */}
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Recommended</span>
                    <span className="text-green-400 font-bold">
                      +{recommendation.recommended} {recommendation.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      ≈ ${recommendation.usdValue}
                    </span>
                    <span className="text-gray-500">
                      {recommendation.reason}
                    </span>
                  </div>
                </div>

                {/* Quick select buttons */}
                <div className="flex gap-2">
                  {[
                    { label: "Light", mult: 0.5 },
                    { label: "Rec.", mult: 1 },
                    { label: "Heavy", mult: 2 },
                  ].map(({ label, mult }) => (
                    <button
                      key={label}
                      onClick={() => {
                        const amount = (
                          recommendation.recommended * mult
                        ).toFixed(6);
                        handleCustomAmountChange(amount);
                        toast.success(
                          `Set to ${amount} ${recommendation.symbol}`
                        );
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        customAmount ===
                        (recommendation.recommended * mult).toFixed(6)
                          ? "bg-purple-500 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {label}
                      <span className="block text-xs opacity-70">
                        {(recommendation.recommended * mult).toFixed(4)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom amount input */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Custom amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                      placeholder={recommendation.recommended.toString()}
                      step="0.001"
                      className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="flex items-center px-3 bg-gray-800 border border-gray-600 rounded-lg text-gray-400 text-sm">
                      {recommendation.symbol}
                    </span>
                  </div>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <FaInfoCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300">
                    You'll receive your swapped tokens <strong>AND</strong>{" "}
                    native gas on {destChain.toUpperCase()} in a single flow.
                    Perfect for landing ready to trade!
                  </p>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed hint when disabled */}
      {!enabled && (
        <p className="text-xs text-gray-500 mt-2">
          ↑ Enable to also receive native gas on the destination chain
        </p>
      )}
    </motion.div>
  );
}

/**
 * Gas-on-Arrival Success Banner
 */
export function GasOnArrivalSuccess({
  mainShiftId,
  gasShiftId,
  destChain,
  gasAmount,
  gasSymbol,
}: {
  mainShiftId: string;
  gasShiftId: string;
  destChain: string;
  gasAmount: string;
  gasSymbol: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-green-500/20 rounded-full">
          <FaCheckCircle className="text-green-400 text-2xl" />
        </div>
        <div>
          <h4 className="font-bold text-green-400">Gas-on-Arrival Active!</h4>
          <p className="text-sm text-gray-400">
            You'll land on {destChain.toUpperCase()} ready to go
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Main Swap</p>
          <code className="text-xs text-blue-400 break-all">{mainShiftId}</code>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Gas Shift</p>
          <code className="text-xs text-purple-400 break-all">
            {gasShiftId}
          </code>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-sm">
        <FaRocket className="text-purple-400" />
        <span className="text-gray-300">
          +{gasAmount} {gasSymbol} gas incoming
        </span>
        <FaBolt className="text-yellow-400" />
      </div>
    </motion.div>
  );
}
