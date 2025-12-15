/**
 * QR Code Component - Display QR code for deposit addresses
 * Wave 3 Feature: QR Codes Everywhere
 * Uses local qrcode library instead of external API for better performance
 */

import { motion } from "framer-motion";
import QRCodeLib from "qrcode";
import { useEffect, useState } from "react";
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
  darkColor?: string;
  lightColor?: string;
}

/**
 * Generate QR code as data URL using local library
 */
async function generateQRCode(
  data: string,
  size: number = 200,
  darkColor: string = "#22c55e",
  lightColor: string = "#1f2937"
): Promise<string> {
  try {
    const dataUrl = await QRCodeLib.toDataURL(data, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: darkColor,
        light: lightColor,
      },
    });
    return dataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return "";
  }
}

export default function QRCode({
  value,
  size = 200,
  label,
  showCopy = true,
  showExplorer = false,
  explorerUrl,
  className = "",
  darkColor = "#000000", // Black for better scanning
  lightColor = "#ffffff", // White background
}: QRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const generate = async () => {
      setIsLoading(true);
      const dataUrl = await generateQRCode(value, size, darkColor, lightColor);
      if (mounted) {
        setQrDataUrl(dataUrl);
        setIsLoading(false);
      }
    };

    generate();

    return () => {
      mounted = false;
    };
  }, [value, size, darkColor, lightColor]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard!");
    } catch {
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

      <div className="bg-gray-800 p-3 rounded-xl shadow-lg border border-green-500/30">
        {isLoading ? (
          <div
            className="flex items-center justify-center bg-gray-700 rounded-lg animate-pulse"
            style={{ width: size, height: size }}
          >
            <FaQrcode className="text-gray-500 text-3xl" />
          </div>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            width={size}
            height={size}
            className="rounded-lg"
          />
        ) : (
          <div
            className="flex items-center justify-center bg-gray-700 rounded-lg"
            style={{ width: size, height: size }}
          >
            <span className="text-red-400 text-sm">QR Error</span>
          </div>
        )}
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
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const generate = async () => {
      const dataUrl = await generateQRCode(value, size, "#22c55e", "#1f2937");
      if (mounted) {
        setQrDataUrl(dataUrl);
      }
    };

    generate();

    return () => {
      mounted = false;
    };
  }, [value, size]);

  return (
    <div className="inline-flex items-center gap-3 bg-gray-800/50 rounded-lg p-2">
      <div className="bg-gray-800 p-1 rounded border border-green-500/20">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR"
            width={size}
            height={size}
            className="rounded"
          />
        ) : (
          <div
            className="flex items-center justify-center bg-gray-700 rounded animate-pulse"
            style={{ width: size, height: size }}
          >
            <FaQrcode className="text-gray-500" />
          </div>
        )}
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

/**
 * Large QR Code for order confirmation dialogs
 */
export function QRCodeLarge({
  value,
  coin,
  amount,
  network,
}: {
  value: string;
  coin?: string;
  amount?: string;
  network?: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    const generate = async () => {
      const dataUrl = await generateQRCode(value, 250, "#22c55e", "#ffffff");
      if (mounted) {
        setQrDataUrl(dataUrl);
      }
    };

    generate();

    return () => {
      mounted = false;
    };
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      {coin && amount && (
        <p className="text-sm text-gray-300 mb-3">
          Send{" "}
          <span className="text-green-400 font-semibold">
            {amount} {coin.toUpperCase()}
          </span>
          {network && <span className="text-gray-400"> on {network}</span>} to:
        </p>
      )}

      <div className="bg-white p-4 rounded-xl shadow-xl">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            width={250}
            height={250}
            className="rounded-lg"
          />
        ) : (
          <div className="w-[250px] h-[250px] flex items-center justify-center bg-gray-100 rounded-lg animate-pulse">
            <FaQrcode className="text-gray-400 text-4xl" />
          </div>
        )}
      </div>

      <div className="mt-4 bg-gray-900/80 border border-gray-700 rounded-lg p-3 max-w-sm">
        <code className="text-sm text-green-400 break-all block text-center font-mono">
          {value}
        </code>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Address copied!");
        }}
        className="mt-3 flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors w-full max-w-sm"
      >
        <FaCopy />
        Copy Deposit Address
      </motion.button>
    </div>
  );
}
