import { useEffect, useState } from "react";
import {
  FaCheck,
  FaChevronDown,
  FaCopy,
  FaHistory,
  FaLink,
  FaShareAlt,
  FaSignOutAlt,
  FaWallet,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { formatAddress, useWallet } from "../hooks/useWallet";

export default function WalletButton() {
  const {
    address,
    isConnected,
    isAuthenticated,
    referralCode,
    isLoading,
    error,
    connect,
    disconnect,
    signIn,
    signOut,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Pulse animation on connect
  useEffect(() => {
    if (isAuthenticated) {
      setPulseAnimation(true);
      setTimeout(() => setPulseAnimation(false), 2000);
    }
  }, [isAuthenticated]);

  const handleConnect = async () => {
    await connect();
  };

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

  const copyReferralLink = () => {
    if (referralCode) {
      // Use current origin for the referral link (works on localhost and production)
      const baseUrl = window.location.origin;
      navigator.clipboard.writeText(`${baseUrl}?ref=${referralCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <button
        disabled
        className="relative px-5 py-2.5 bg-gray-800/80 text-gray-400 rounded-xl flex items-center gap-2 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-purple-500/20 animate-pulse" />
        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="relative z-10">Connecting...</span>
      </button>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="group relative px-5 py-2.5 overflow-hidden rounded-xl font-semibold transition-all duration-300"
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 transition-all duration-500" />
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Shine effect */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />

        <div className="relative z-10 flex items-center gap-2 text-white">
          <FaWallet className="w-4 h-4 group-hover:animate-bounce" />
          <span>Connect Wallet</span>
        </div>
      </button>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-800/60 rounded-lg border border-gray-700/50">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-gray-400 text-sm font-mono">
            {formatAddress(address!)}
          </span>
        </div>
        <button
          onClick={handleSignIn}
          className="group relative px-4 py-2.5 overflow-hidden rounded-xl font-semibold transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600" />
          <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="relative z-10 flex items-center gap-2 text-white">
            <FaWallet className="w-4 h-4" />
            <span>Sign In</span>
          </div>
        </button>
        <button
          onClick={disconnect}
          className="p-2.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-300"
          title="Disconnect"
        >
          <FaSignOutAlt className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`group relative px-4 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
          pulseAnimation ? "animate-pulse" : ""
        }`}
      >
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl border border-gray-700/50 group-hover:border-green-500/30 transition-all duration-300" />

        {/* Glow on hover */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="relative">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
            <div className="absolute inset-0 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping" />
          </div>
          <span className="text-white font-mono text-sm">
            {formatAddress(address!)}
          </span>
          <FaChevronDown
            className={`w-3 h-3 text-gray-400 transition-transform duration-300 ${
              showDropdown ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          <div className="absolute right-0 mt-2 w-80 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Dropdown glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-teal-500/20 rounded-2xl blur-lg" />

            <div className="relative bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl">
                    <FaWallet className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      Connected Wallet
                    </div>
                    <div className="text-white font-mono text-sm mt-0.5">
                      {formatAddress(address!)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral Section */}
              {referralCode && (
                <div className="p-4 border-b border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <FaLink className="w-3 h-3 text-green-400" />
                      <span>Your Referral Code</span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full">
                      0.5% BONUS
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl text-green-400 font-mono text-lg font-bold text-center">
                      {referralCode}
                    </code>
                    <button
                      onClick={copyReferralLink}
                      className={`p-3 rounded-xl transition-all duration-300 ${
                        copied
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                      }`}
                      title="Copy referral link"
                    >
                      {copied ? (
                        <FaCheck className="w-4 h-4" />
                      ) : (
                        <FaCopy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Share your link and earn from every swap!
                  </p>
                </div>
              )}

              {/* Quick Links */}
              <div className="p-2">
                <Link
                  to="/referrals"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
                >
                  <div className="p-1.5 bg-green-500/10 rounded-lg">
                    <FaShareAlt className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="font-medium">Referral Dashboard</span>
                </Link>
                <Link
                  to="/history"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
                >
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                    <FaHistory className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="font-medium">Transaction History</span>
                </Link>
              </div>

              {/* Divider */}
              <div className="mx-4 border-t border-gray-700/50" />

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={() => {
                    signOut();
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/5 rounded-xl transition-all duration-200"
                >
                  <FaSignOutAlt className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
                <button
                  onClick={() => {
                    disconnect();
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-200"
                >
                  <FaWallet className="w-4 h-4" />
                  <span>Disconnect Wallet</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error toast */}
      {error && (
        <div className="absolute right-0 mt-2 p-4 bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2 z-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
