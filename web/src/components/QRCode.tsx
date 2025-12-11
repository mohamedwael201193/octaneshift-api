/**
 * QR Code Component - Display QR code for deposit addresses
 * Wave 3 Feature: QR Codes Everywhere
 */

import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { FaCopy, FaExternalLinkAlt, FaQrcode } from "react-icons/fa";

interface QRCodeProps {
  value: string;
  size?: number;
  label?: string;
  showCopy?: boolean;
  showExplorer?: boolean;
  explorerUrl?: string;
  className?: string;
}

/**
 * Generate QR code URL using QR Server API
 */
function getQRCodeUrl(data: string, size: number = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}&bgcolor=1f2937&color=22c55e&format=png`;
}

export default function QRCode({
  value,
  size = 200,
  label,
  showCopy = true,
  showExplorer = false,
  explorerUrl,
  className = "",
}: QRCodeProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard!");
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Copied to clipboard!");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col items-center ${className}`}
    >
      {label && (
        <p className="text-sm text-gray-400 mb-3 flex items-center gap-2">
          <FaQrcode className="text-green-400" />
          {label}
        </p>
      )}

      <div className="bg-white p-3 rounded-xl shadow-lg">
        <img
          src={getQRCodeUrl(value, size)}
          alt="QR Code"
          width={size}
          height={size}
          className="rounded-lg"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <div className="mt-4 w-full max-w-xs">
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3 mb-3">
          <code className="text-xs text-green-400 break-all block text-center">
            {value.length > 50
              ? `${value.slice(0, 25)}...${value.slice(-20)}`
              : value}
          </code>
        </div>

        <div className="flex gap-2">
          {showCopy && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaCopy />
              Copy
            </motion.button>
          )}

          {showExplorer && explorerUrl && (
            <motion.a
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaExternalLinkAlt />
              Explorer
            </motion.a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Compact QR code for inline use
 */
export function QRCodeCompact({
  value,
  size = 100,
}: {
  value: string;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-3 bg-gray-800/50 rounded-lg p-2">
      <div className="bg-white p-1 rounded">
        <img
          src={getQRCodeUrl(value, size)}
          alt="QR"
          width={size}
          height={size}
          className="rounded"
        />
      </div>
      <div className="flex-1 min-w-0">
        <code className="text-xs text-gray-400 break-all block">
          {value.slice(0, 20)}...
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied!");
          }}
          className="text-xs text-green-400 hover:text-green-300 mt-1"
        >
          Copy address
        </button>
      </div>
    </div>
  );
}
