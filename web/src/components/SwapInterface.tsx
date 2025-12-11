import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FaArrowDown,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSpinner,
} from "react-icons/fa";
import { DEPOSIT_TOKENS, SUPPORTED_CHAINS } from "../config/chains";
import octaneAPI from "../services/api";
import GasOnArrivalToggle from "./GasOnArrival";
import QRCode from "./QRCode";
import TokenSelect, {
  createChainOptions,
  createDepositTokenOptions,
} from "./TokenSelect";

// Pre-create options for selectors
const depositTokenOptions = createDepositTokenOptions(DEPOSIT_TOKENS);
const chainOptions = createChainOptions(SUPPORTED_CHAINS);

interface OrderDetails {
  shiftId: string;
  depositAddress: string;
  depositAmount: string;
  depositCoin: string;
  gasShiftId?: string;
  gasDepositAddress?: string;
  gasAmount?: string;
  gasSymbol?: string;
}

interface SwapInterfaceProps {
  prefilledChain?: string;
  prefilledAmount?: string;
  prefilledAddress?: string;
}

export default function SwapInterface({
  prefilledChain,
  prefilledAmount,
  prefilledAddress,
}: SwapInterfaceProps = {}) {
  // Map chain names to toChain format (e.g., 'base' -> 'eth-base', 'eth' -> 'eth-ethereum')
  const getToChainFromName = (chainName?: string) => {
    if (!chainName) return "eth-base";
    const mapping: Record<string, string> = {
      // Short IDs (new format)
      eth: "eth-ethereum",
      base: "eth-base",
      arb: "eth-arbitrum",
      op: "eth-optimism",
      pol: "matic-polygon",
      avax: "avax-avalanche",
      // Full names (old format - for backward compatibility)
      ethereum: "eth-ethereum",
      arbitrum: "eth-arbitrum",
      optimism: "eth-optimism",
      polygon: "matic-polygon",
      avalanche: "avax-avalanche",
    };
    return mapping[chainName.toLowerCase()] || "eth-base";
  };

  // Get chain alias from toChain (e.g., 'eth-base' -> 'base')
  const getChainAlias = (toChainValue: string): string => {
    const network = toChainValue.split("-")[1] || "base";
    const aliasMap: Record<string, string> = {
      ethereum: "eth",
      base: "base",
      arbitrum: "arb",
      optimism: "op",
      polygon: "pol",
      avalanche: "avax",
    };
    return aliasMap[network] || network;
  };

  const [fromToken, setFromToken] = useState("usdt-ethereum");
  const [toChain, setToChain] = useState(getToChainFromName(prefilledChain));
  // Use minimum of 5 USDT to avoid "below minimum" errors from SideShift
  const normalizedAmount =
    prefilledAmount && parseFloat(prefilledAmount) < 5
      ? "5"
      : prefilledAmount || "10";
  const [amount, setAmount] = useState(normalizedAmount);
  const [settleAddress, setSettleAddress] = useState(prefilledAddress || "");
  const [settleMemo, setSettleMemo] = useState("");
  const [isCreatingShift, setIsCreatingShift] = useState(false);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);

  // Wave 3: Gas-on-Arrival state
  const [gasOnArrivalEnabled, setGasOnArrivalEnabled] = useState(false);
  const [_gasAmount, setGasAmount] = useState(""); // Used by GasOnArrivalToggle component

  // Wave 3: Address validation state
  const [addressValidation, setAddressValidation] = useState<{
    valid: boolean;
    hint: string;
    checking: boolean;
  }>({ valid: true, hint: "", checking: false });

  // Debounced address validation
  const validateAddress = useCallback(
    async (address: string, network: string) => {
      if (!address || address.length < 10) {
        setAddressValidation({ valid: true, hint: "", checking: false });
        return;
      }

      setAddressValidation((prev) => ({ ...prev, checking: true }));

      try {
        const result = await octaneAPI.validateAddress(address, network);
        setAddressValidation({
          valid: result.data.valid,
          hint: result.data.hint,
          checking: false,
        });
      } catch (error) {
        // If validation endpoint fails, don't block the user
        setAddressValidation({ valid: true, hint: "", checking: false });
      }
    },
    []
  );

  // Validate address when it changes (with debounce)
  useEffect(() => {
    const network = toChain.split("-")[1] || "ethereum";
    const timeoutId = setTimeout(() => {
      validateAddress(settleAddress, network);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [settleAddress, toChain, validateAddress]);

  // Check if selected coin requires memo (XRP, XLM, EOS, etc.)
  const requiresMemo = () => {
    const [coin] = toChain.split("-");
    return ["xrp", "xlm", "eos"].includes(coin.toLowerCase());
  };

  const {
    data: quote,
    isLoading: quoteLoading,
    error: quoteError,
    refetch: refetchQuote,
  } = useQuery({
    queryKey: ["quote", fromToken, toChain, amount],
    queryFn: async () => {
      try {
        return await octaneAPI.getQuote(fromToken, toChain, amount);
      } catch (error: any) {
        // Log error but don't show toast during auto-fetch
        console.error(
          "Failed to fetch quote:",
          error.response?.status,
          error.message
        );
        throw error;
      }
    },
    enabled: !!fromToken && !!toChain && !!amount && parseFloat(amount) > 0,
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });

  const handleGetQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    await refetchQuote();
    toast.success("Quote updated!");
  };

  const handleCreateShift = async () => {
    if (!settleAddress) {
      toast.error("Please enter your wallet address");
      return;
    }

    if (!quote?.data) {
      toast.error("Please get a quote first");
      return;
    }

    setIsCreatingShift(true);

    try {
      const [depositCoin, depositNetwork] = fromToken.split("-");
      const [settleCoin, settleNetwork] = toChain.split("-");

      const shiftData = {
        depositCoin: depositCoin.toUpperCase(),
        depositNetwork,
        settleCoin: settleCoin.toUpperCase(),
        settleNetwork,
        settleAddress,
        ...(settleMemo && { settleMemo }),
      };

      const result = await octaneAPI.createShift(shiftData);
      const shift = result.data;

      setOrderDetails({
        shiftId: shift.id,
        depositAddress: shift.depositAddress,
        depositAmount: amount,
        depositCoin: depositCoin.toUpperCase(),
      });

      toast.success("Order created successfully!");

      setTimeout(() => {
        document
          .getElementById("order-details")
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsCreatingShift(false);
    }
  };

  return (
    <div
      id="swap-section"
      className="py-24 px-4 bg-gradient-to-b from-black to-gray-900"
    >
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-purple-500 text-transparent bg-clip-text">
            Start Swapping
          </h2>
          <p className="text-xl text-gray-400">Get gas tokens in minutes</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-700 shadow-2xl"
        >
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3 text-gray-300">
              From
            </label>
            <TokenSelect
              value={fromToken}
              onChange={setFromToken}
              options={depositTokenOptions}
              placeholder="Select token to send"
              searchable={true}
            />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-full mt-3 bg-gray-900/70 border border-gray-600 rounded-xl px-4 py-4 text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
            />
          </div>

          <div className="flex justify-center my-6">
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-purple-500 flex items-center justify-center"
            >
              <FaArrowDown className="text-2xl text-white" />
            </motion.div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3 text-gray-300">
              To
            </label>
            <TokenSelect
              value={toChain}
              onChange={setToChain}
              options={chainOptions}
              placeholder="Select destination chain"
              searchable={true}
            />
          </div>

          {quoteError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6"
            >
              <h3 className="font-bold text-red-400 mb-2">⚠️ Quote Error</h3>
              <p className="text-sm text-gray-300 mb-3">
                {(quoteError as any)?.response?.status === 451
                  ? "Service not available in your region. Please try using a VPN or contact support."
                  : "Unable to fetch quote. The backend API may be starting up (this can take 1-2 minutes on free tier). Please try again."}
              </p>
              <button
                onClick={() => refetchQuote()}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-300 text-sm transition-all"
              >
                Retry
              </button>
            </motion.div>
          )}

          {quote?.data && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-green-500/10 to-purple-500/10 border border-green-500/30 rounded-xl p-5 mb-6"
            >
              <h3 className="font-bold text-green-400 mb-3">Quote Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate:</span>
                  <span className="text-white font-semibold">
                    {quote.data.rate || "Variable"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min:</span>
                  <span className="text-white font-semibold">
                    {quote.data.min}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max:</span>
                  <span className="text-white font-semibold">
                    {quote.data.max}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-3 text-gray-300">
              Your Wallet Address
            </label>
            <div className="relative">
              <input
                type="text"
                value={settleAddress}
                onChange={(e) => setSettleAddress(e.target.value)}
                placeholder="0x..."
                className={`w-full bg-gray-900/70 border rounded-xl px-4 py-4 text-white font-mono focus:outline-none focus:ring-2 transition-all pr-12 ${
                  settleAddress && !addressValidation.checking
                    ? addressValidation.valid
                      ? "border-green-500/50 focus:ring-green-500"
                      : "border-red-500/50 focus:ring-red-500"
                    : "border-gray-600 focus:ring-purple-500"
                }`}
              />
              {/* Validation indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {addressValidation.checking ? (
                  <FaSpinner className="text-gray-400 animate-spin" />
                ) : settleAddress ? (
                  addressValidation.valid ? (
                    <FaCheckCircle className="text-green-400" />
                  ) : (
                    <FaExclamationTriangle className="text-red-400" />
                  )
                ) : null}
              </div>
            </div>
            {/* Validation hint */}
            {settleAddress &&
              !addressValidation.checking &&
              addressValidation.hint && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-2 text-xs ${
                    addressValidation.valid
                      ? "text-green-400/70"
                      : "text-red-400"
                  }`}
                >
                  {addressValidation.hint}
                </motion.p>
              )}
          </div>

          {requiresMemo() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <label className="block text-sm font-semibold mb-3 text-gray-300">
                Memo / Destination Tag{" "}
                <span className="text-red-400 font-bold">(Required)</span>
              </label>
              <input
                type="text"
                value={settleMemo}
                onChange={(e) => setSettleMemo(e.target.value)}
                placeholder="Enter memo/tag - REQUIRED for this network"
                className="w-full bg-gray-900/70 border border-red-600/50 rounded-xl px-4 py-4 text-white font-mono focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              />
              <p className="mt-2 text-xs text-red-400/70">
                🚨 WARNING: Without a memo/tag, your funds may be lost
                permanently!
              </p>
            </motion.div>
          )}

          {/* Wave 3: Gas-on-Arrival Toggle */}
          <GasOnArrivalToggle
            destChain={getChainAlias(toChain)}
            enabled={gasOnArrivalEnabled}
            onToggle={setGasOnArrivalEnabled}
            onAmountChange={setGasAmount}
            className="mb-6"
          />

          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetQuote}
              disabled={quoteLoading || orderDetails !== null}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-2"
            >
              {quoteLoading && <FaSpinner className="animate-spin" />}
              {orderDetails
                ? "Order Active"
                : quoteLoading
                ? "Loading..."
                : "Get Quote"}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateShift}
              disabled={
                !quote?.data ||
                !settleAddress ||
                isCreatingShift ||
                orderDetails !== null
              }
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-green-500/50 flex items-center justify-center gap-2"
            >
              {isCreatingShift && <FaSpinner className="animate-spin" />}
              {orderDetails
                ? "Order Active"
                : isCreatingShift
                ? "Creating..."
                : "Create Order"}
            </motion.button>
          </div>

          {orderDetails && (
            <motion.div
              id="order-details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-green-900/20 border border-green-500/50 rounded-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-green-400">
                  ✅ Order Created Successfully!
                </h3>
                <button
                  onClick={() => setOrderDetails(null)}
                  className="text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">
                  Shift ID (for tracking):
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-green-400 font-mono text-sm break-all">
                    {orderDetails.shiftId}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(orderDetails.shiftId);
                      toast.success("Shift ID copied!");
                    }}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* QR Code for deposit address */}
              <div className="mb-4 flex justify-center">
                <QRCode
                  value={orderDetails.depositAddress}
                  size={180}
                  label={`Send ${orderDetails.depositAmount} ${orderDetails.depositCoin} to:`}
                  showCopy={true}
                />
              </div>

              <div className="p-4 bg-gray-900/50 rounded-lg mb-4">
                <p className="text-sm text-gray-400 mb-3">
                  Send exactly{" "}
                  <span className="text-white font-bold">
                    {orderDetails.depositAmount} {orderDetails.depositCoin}
                  </span>{" "}
                  to:
                </p>
                <div className="bg-gray-800 p-3 rounded-lg mb-3">
                  <code className="text-sm font-mono text-blue-400 break-all block">
                    {orderDetails.depositAddress}
                  </code>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(orderDetails.depositAddress);
                    toast.success("Address copied!");
                  }}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  📋 Copy Deposit Address
                </button>
              </div>

              {/* Gas-on-Arrival info if enabled */}
              {orderDetails.gasShiftId && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg mb-4"
                >
                  <h4 className="font-bold text-purple-400 mb-2">
                    🚀 Gas-on-Arrival Active!
                  </h4>
                  <p className="text-sm text-gray-400 mb-3">
                    You'll also receive{" "}
                    <span className="text-white font-bold">
                      {orderDetails.gasAmount} {orderDetails.gasSymbol}
                    </span>{" "}
                    gas
                  </p>
                  <div className="flex justify-center mb-2">
                    <QRCode
                      value={orderDetails.gasDepositAddress || ""}
                      size={120}
                      label="Gas deposit address:"
                      showCopy={true}
                    />
                  </div>
                  <code className="text-xs text-purple-400 break-all block text-center">
                    {orderDetails.gasDepositAddress}
                  </code>
                </motion.div>
              )}

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => {
                    window.location.href = `/proof/${orderDetails.shiftId}`;
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                >
                  📄 View Proof
                </button>
                <button
                  onClick={() => {
                    const trackerSection =
                      document.getElementById("tracker-section");
                    if (trackerSection) {
                      trackerSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
                >
                  🔍 Track Order
                </button>
                <button
                  onClick={() => {
                    setOrderDetails(null);
                    setSettleAddress("");
                    setAmount("10");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  🔄 New Order
                </button>
              </div>

              <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-400">
                  ⏱️ Please send funds within 10 minutes. You can track the
                  status anytime using the Shift ID.
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
