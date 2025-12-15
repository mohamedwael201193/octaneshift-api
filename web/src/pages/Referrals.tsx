import { useEffect, useState } from "react";
import {
  FaChartLine,
  FaCheck,
  FaCopy,
  FaDollarSign,
  FaGem,
  FaLink,
  FaRocket,
  FaTelegram,
  FaTrophy,
  FaTwitter,
  FaUsers,
} from "react-icons/fa";
import { useWallet } from "../hooks/useWallet";
import octaneAPI from "../services/api";

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  sideshiftLink: string;
  stats: {
    totalReferrals: number;
    activeReferrals: number;
    totalVolumeUsd: number;
    totalCommissionsUsd: number;
    commissionRate: string;
  };
  referredBy: string | null;
  referrals: Array<{
    id: string;
    referredAddress: string;
    status: string;
    volumeGenerated: number;
    commissionsEarned: number;
    createdAt: string;
    firstShiftAt?: string;
  }>;
}

// Animated stat card component
function StatCard({
  icon,
  label,
  value,
  gradient,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  gradient: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* Background glow */}
      <div
        className={`absolute -inset-1 ${gradient} rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500`}
      />

      <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 h-full">
        {/* Icon */}
        <div className={`inline-flex p-3 rounded-xl ${gradient} mb-3`}>
          <span className="text-white">{icon}</span>
        </div>

        {/* Label */}
        <div className="text-gray-400 text-sm mb-1">{label}</div>

        {/* Value with count-up animation */}
        <div className="text-3xl font-bold text-white">{value}</div>
      </div>
    </div>
  );
}

export default function Referrals() {
  const { address, isAuthenticated, signIn } = useWallet();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && address) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, address]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await octaneAPI.getReferralStats(address!);
      setStats(response);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load referral stats");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareOnTwitter = () => {
    if (!stats) return;
    const referralLink = `${window.location.origin}?ref=${stats.referralCode}`;
    const text = `Swap crypto instantly with @OctaneShift - no KYC, no hassle!\n\nUse my link: ${referralLink}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  const shareOnTelegram = () => {
    if (!stats) return;
    const referralLink = `${window.location.origin}?ref=${stats.referralCode}`;
    const text = `🚀 Need gas on any chain? Use OctaneShift!\n\nFast swaps, no KYC required.\n\n👉 ${referralLink}`;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(
        referralLink
      )}&text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30 mb-6">
              <FaGem className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">
                Earn Passive Income
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                Referral Program
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Share your unique link and earn{" "}
              <span className="text-green-400 font-bold">0.5%</span> commission
              on every swap
            </p>
          </div>

          {/* Feature Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500" />

            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-white/10 overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-pulse" />
                <div
                  className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500 rounded-full blur-3xl animate-pulse"
                  style={{ animationDelay: "1s" }}
                />
              </div>

              <div className="relative z-10 text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-50 animate-pulse" />
                  <div className="relative p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl border border-purple-500/30">
                    <FaLink className="w-16 h-16 text-purple-400" />
                  </div>
                </div>

                <h2 className="text-3xl font-bold mb-4">Start Earning Today</h2>
                <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                  Connect your wallet and get your unique referral link. Share
                  it with friends and earn commissions on every swap they make -
                  forever!
                </p>

                {/* Benefits */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <FaTrophy className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                    <div className="font-semibold">0.5% Commission</div>
                    <div className="text-sm text-gray-500">
                      On all swap volume
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <FaUsers className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <div className="font-semibold">Unlimited Referrals</div>
                    <div className="text-sm text-gray-500">
                      No caps or limits
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <FaRocket className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <div className="font-semibold">Lifetime Earnings</div>
                    <div className="text-sm text-gray-500">Earn forever</div>
                  </div>
                </div>

                <button
                  onClick={() => signIn()}
                  className="group relative inline-flex items-center gap-3 px-8 py-4 overflow-hidden rounded-2xl font-bold text-lg transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600" />
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <span className="relative z-10 text-white">
                    Connect & Start Earning
                  </span>
                  <FaRocket className="relative z-10 w-5 h-5 text-white group-hover:animate-bounce" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-col items-center justify-center h-64">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-purple-500/30 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-4 text-gray-400">Loading your referral stats...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchStats}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full border border-green-500/30 mb-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-300 text-sm font-medium">
              Active Referrer
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
              Your Referral Dashboard
            </span>
          </h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<FaUsers className="w-5 h-5" />}
            label="Total Referrals"
            value={stats?.stats.totalReferrals || 0}
            gradient="bg-gradient-to-r from-blue-500 to-cyan-500"
            delay={0}
          />
          <StatCard
            icon={<FaChartLine className="w-5 h-5" />}
            label="Active"
            value={stats?.stats.activeReferrals || 0}
            gradient="bg-gradient-to-r from-green-500 to-emerald-500"
            delay={100}
          />
          <StatCard
            icon={<FaDollarSign className="w-5 h-5" />}
            label="Volume Generated"
            value={`$${(stats?.stats.totalVolumeUsd || 0).toFixed(2)}`}
            gradient="bg-gradient-to-r from-purple-500 to-pink-500"
            delay={200}
          />
          <StatCard
            icon={<FaTrophy className="w-5 h-5" />}
            label="Commissions Earned"
            value={`$${(stats?.stats.totalCommissionsUsd || 0).toFixed(2)}`}
            gradient="bg-gradient-to-r from-amber-500 to-orange-500"
            delay={300}
          />
        </div>

        {/* Referral Link Section */}
        <div className="relative group mb-8">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-3xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-500" />

          <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl">
                <FaLink className="w-5 h-5 text-purple-400" />
              </div>
              Your Referral Link
            </h2>

            <div className="space-y-5">
              {/* Referral Code */}
              <div>
                <label className="text-sm text-gray-400 block mb-2 font-medium">
                  Your Unique Code
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur opacity-50" />
                    <code className="relative block w-full px-6 py-4 bg-gray-800/80 rounded-xl text-green-400 font-mono text-2xl font-bold text-center border border-green-500/30">
                      {stats?.referralCode}
                    </code>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(stats?.referralCode || "", "code")
                    }
                    className={`p-4 rounded-xl transition-all duration-300 ${
                      copied === "code"
                        ? "bg-green-500/20 text-green-400 scale-95"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    {copied === "code" ? (
                      <FaCheck className="w-5 h-5" />
                    ) : (
                      <FaCopy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Referral Link */}
              <div>
                <label className="text-sm text-gray-400 block mb-2 font-medium">
                  Share This Link
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={
                      stats?.referralCode
                        ? `${window.location.origin}?ref=${stats.referralCode}`
                        : ""
                    }
                    className="flex-1 px-5 py-4 bg-gray-800/80 rounded-xl text-white font-mono text-sm border border-gray-700/50 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={() =>
                      copyToClipboard(
                        stats?.referralCode
                          ? `${window.location.origin}?ref=${stats.referralCode}`
                          : "",
                        "link"
                      )
                    }
                    className={`p-4 rounded-xl transition-all duration-300 ${
                      copied === "link"
                        ? "bg-green-500/20 text-green-400 scale-95"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                    }`}
                  >
                    {copied === "link" ? (
                      <FaCheck className="w-5 h-5" />
                    ) : (
                      <FaCopy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={shareOnTwitter}
                  className="group flex-1 relative px-5 py-4 overflow-hidden rounded-xl font-semibold transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="relative z-10 flex items-center justify-center gap-2 text-white">
                    <FaTwitter className="w-5 h-5" />
                    Share on Twitter
                  </div>
                </button>
                <button
                  onClick={shareOnTelegram}
                  className="group flex-1 relative px-5 py-4 overflow-hidden rounded-xl font-semibold transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-cyan-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="relative z-10 flex items-center justify-center gap-2 text-white">
                    <FaTelegram className="w-5 h-5" />
                    Share on Telegram
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Commission Rate Info */}
        <div className="relative group mb-8">
          <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-30" />

          <div className="relative bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <FaGem className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-3 text-green-400">
                  How it Works
                </h3>
                <ul className="text-gray-300 space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Share your referral link with friends and followers
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    When they sign up and make swaps, you earn{" "}
                    <span className="text-green-400 font-bold">0.5%</span> of
                    their volume
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Commissions are tracked automatically - same rate as
                    SideShift!
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    No limits on how many people you can refer
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Referrals List */}
        {stats?.referrals && stats.referrals.length > 0 && (
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-gray-500/10 to-gray-600/10 rounded-3xl blur-xl" />

            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FaUsers className="w-5 h-5 text-purple-400" />
                  Your Referrals
                </h2>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                  {stats.referrals.length} total
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {stats.referrals.map((ref, index) => (
                  <div
                    key={ref.id}
                    className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div>
                      <div className="font-mono text-sm text-white">
                        {ref.referredAddress}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Joined {new Date(ref.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                          ref.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {ref.status.toUpperCase()}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        ${ref.volumeGenerated.toFixed(2)} volume
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!stats?.referrals || stats.referrals.length === 0) && (
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-gray-500/10 to-gray-600/10 rounded-3xl blur-xl" />

            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-12 border border-white/10 text-center">
              <div className="inline-flex p-4 bg-gray-800/50 rounded-2xl mb-4">
                <FaUsers className="w-12 h-12 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">No Referrals Yet</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                Share your referral link to start earning commissions on every
                swap!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
