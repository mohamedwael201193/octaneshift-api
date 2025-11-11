import axios from "axios";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface Recipient {
  settleAddress: string;
  settleAmount: string;
}

interface BatchResult {
  index: number;
  status: "created" | "failed";
  shiftId?: string;
  depositAddress?: string;
  error?: string;
  address: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function BatchTopUp() {
  const [recipients, setRecipients] = useState<Recipient[]>([
    { settleAddress: "", settleAmount: "" },
  ]);
  const [chain, setChain] = useState("ethereum");
  const [depositCoin, setDepositCoin] = useState("usdt");
  const [depositNetwork, setDepositNetwork] = useState("tron");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [payoutId, setPayoutId] = useState<string>("");

  const addRecipient = () => {
    if (recipients.length >= 50) {
      toast.error("Maximum 50 recipients allowed");
      return;
    }
    setRecipients([...recipients, { settleAddress: "", settleAmount: "" }]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (
    index: number,
    field: keyof Recipient,
    value: string
  ) => {
    const updated = [...recipients];
    updated[index][field] = value;
    setRecipients(updated);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim());

      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes("address") ? 1 : 0;
      const parsed: Recipient[] = [];

      for (let i = startIndex; i < lines.length && i < 50; i++) {
        const [address, amount] = lines[i].split(",").map((s) => s.trim());
        if (address && amount) {
          parsed.push({ settleAddress: address, settleAmount: amount });
        }
      }

      if (parsed.length > 0) {
        setRecipients(parsed);
        toast.success(`Loaded ${parsed.length} recipients`);
      } else {
        toast.error("No valid recipients found in CSV");
      }
    };

    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    // Validation
    const validRecipients = recipients.filter(
      (r) => r.settleAddress.trim() && r.settleAmount.trim()
    );

    if (validRecipients.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await axios.post(
        `${API_BASE_URL}/api/topup/batch`,
        {
          settleCoin: "eth",
          settleNetwork: chain,
          depositCoin,
          depositNetwork,
          items: validRecipients,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setResults(response.data.data.results);
        setPayoutId(response.data.data.payoutId);
        toast.success(
          `Batch created! ${response.data.data.summary.success}/${response.data.data.summary.total} successful`
        );
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create batch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Batch Top-Up
          </h1>
          <p className="text-gray-400">
            Top up multiple addresses in one transaction (max 50)
          </p>
        </motion.div>

        {/* Configuration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
        >
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Settle Network
              </label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="ethereum">Ethereum</option>
                <option value="base">Base</option>
                <option value="polygon">Polygon</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Deposit Coin
              </label>
              <select
                value={depositCoin}
                onChange={(e) => setDepositCoin(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="usdt">USDT</option>
                <option value="usdc">USDC</option>
                <option value="dai">DAI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Deposit Network
              </label>
              <select
                value={depositNetwork}
                onChange={(e) => setDepositNetwork(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="tron">Tron</option>
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* CSV Upload */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
        >
          <label className="flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-5 h-5 text-blue-400" />
            <span className="text-blue-400 font-medium">Upload CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </label>
          <p className="text-gray-500 text-sm text-center mt-2">
            Format: address, amount (one per line)
          </p>
        </motion.div>

        {/* Recipients Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Recipients ({recipients.length}/50)
            </h2>
            <button
              onClick={addRecipient}
              disabled={recipients.length >= 50}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recipients.map((recipient, index) => (
              <div
                key={index}
                className="flex gap-3 items-center bg-gray-900/50 p-3 rounded-lg"
              >
                <span className="text-gray-500 font-mono text-sm w-8">
                  #{index + 1}
                </span>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient.settleAddress}
                  onChange={(e) =>
                    updateRecipient(index, "settleAddress", e.target.value)
                  }
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Amount"
                  value={recipient.settleAmount}
                  onChange={(e) =>
                    updateRecipient(index, "settleAmount", e.target.value)
                  }
                  className="w-32 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                />
                <button
                  onClick={() => removeRecipient(index)}
                  className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Create Batch Top-Up
              </>
            )}
          </button>
        </motion.div>

        {/* Results */}
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          >
            <h2 className="text-xl font-semibold mb-4">
              Results{" "}
              {payoutId && (
                <span className="text-sm text-gray-400 ml-2">
                  ID: {payoutId}
                </span>
              )}
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result) => (
                <div
                  key={result.index}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    result.status === "created"
                      ? "bg-green-900/20 border border-green-700/50"
                      : "bg-red-900/20 border border-red-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.status === "created" ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <div className="text-white font-mono text-sm">
                        {result.address}
                      </div>
                      {result.error && (
                        <div className="text-red-400 text-xs mt-1">
                          {result.error}
                        </div>
                      )}
                    </div>
                  </div>
                  {result.shiftId && (
                    <span className="text-gray-400 text-xs font-mono">
                      {result.shiftId}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
