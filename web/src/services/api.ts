import axios from "axios";
import toast from "react-hot-toast";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://octaneshift-api-1.onrender.com";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include wallet auth token
api.interceptors.request.use((config) => {
  // Get wallet address from localStorage (set by useWallet hook)
  const walletAddress = localStorage.getItem("octaneshift_wallet_address");
  const isAuthenticated =
    localStorage.getItem("octaneshift_wallet_auth") === "true";

  // If authenticated, use wallet address as auth token
  if (isAuthenticated && walletAddress) {
    config.headers.Authorization = `Bearer ${walletAddress}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      toast.error("Service not available in your region");
    } else if (error.response?.status === 404) {
      toast.error("Not found");
    } else {
      toast.error(error.response?.data?.message || "An error occurred");
    }
    return Promise.reject(error);
  }
);

export const octaneAPI = {
  getHealth: async () => {
    const { data } = await api.get("/health");
    return data;
  },

  getBotStatus: async () => {
    const { data } = await api.get("/api/bot/status");
    return data;
  },

  getPermissions: async () => {
    const { data } = await api.get("/api/permissions");
    return data;
  },

  getQuote: async (from: string, to: string, amount?: string) => {
    const params = new URLSearchParams();
    params.append("from", from);
    params.append("to", to);
    if (amount) params.append("amount", amount);

    const { data } = await api.get(`/api/pair?${params.toString()}`);
    return data;
  },

  createShift: async (shiftData: {
    depositCoin: string;
    depositNetwork: string;
    settleCoin: string;
    settleNetwork: string;
    settleAddress: string;
  }) => {
    const { data } = await api.post("/api/shifts/variable", shiftData);
    return data;
  },

  getShift: async (shiftId: string) => {
    const { data } = await api.get(`/api/shifts/${shiftId}`);
    return data;
  },

  testSideShift: async () => {
    const { data } = await api.get("/api/test/sideshift-health");
    return data;
  },

  // Wave 3: Gas Oracle endpoints
  getGasPrices: async () => {
    const { data } = await api.get("/api/gas/prices");
    return data;
  },

  getGasPrice: async (chain: string) => {
    const { data } = await api.get(`/api/gas/price/${chain}`);
    return data;
  },

  getSmartPresets: async (chain: string) => {
    const { data } = await api.get(`/api/gas/presets/${chain}`);
    return data;
  },

  getOctaneScore: async (chain: string, balance: number) => {
    const { data } = await api.get(`/api/gas/score/${chain}/${balance}`);
    return data;
  },

  getGasSuggestion: async (chain: string, usage: string) => {
    const { data } = await api.get(`/api/gas/suggest/${chain}/${usage}`);
    return data;
  },

  getGasArrivalRecommendation: async (chain: string) => {
    const { data } = await api.get(`/api/gas/arrival/${chain}`);
    return data;
  },

  // Wave 3: Loyalty endpoints
  getLoyaltyStats: async (userId: string) => {
    const { data } = await api.get(`/api/loyalty/stats/${userId}`);
    return data;
  },

  getLoyaltyTiers: async () => {
    const { data } = await api.get("/api/loyalty/tiers");
    return data;
  },

  recordShift: async (
    userId: string,
    chain: string,
    volumeUsd: number,
    isTopUp?: boolean
  ) => {
    const { data } = await api.post("/api/loyalty/record", {
      userId,
      chain,
      volumeUsd,
      isTopUp,
    });
    return data;
  },

  useFreeTopup: async (userId: string) => {
    const { data } = await api.post("/api/loyalty/use-free-topup", { userId });
    return data;
  },

  getLeaderboard: async (limit?: number) => {
    const { data } = await api.get(
      `/api/loyalty/leaderboard${limit ? `?limit=${limit}` : ""}`
    );
    return data;
  },

  getPlatformStats: async () => {
    const { data } = await api.get("/api/loyalty/platform-stats");
    return data;
  },

  // Wave 3: Gas-on-Arrival endpoints
  getGasOnArrivalQuote: async (params: {
    depositCoin: string;
    depositNetwork: string;
    settleCoin: string;
    settleNetwork: string;
    settleAddress: string;
    addGasOnArrival: boolean;
    gasDestChain?: string;
  }) => {
    const { data } = await api.post("/api/gas-on-arrival/quote", params);
    return data;
  },

  createGasOnArrivalShift: async (params: {
    depositCoin: string;
    depositNetwork: string;
    settleCoin: string;
    settleNetwork: string;
    settleAddress: string;
    addGasOnArrival: boolean;
    gasAmount?: string;
    gasDestChain?: string;
    refundAddress?: string;
    settleMemo?: string;
  }) => {
    const { data } = await api.post("/api/gas-on-arrival/create", params);
    return data;
  },

  // Wave 3: Address validation endpoint
  validateAddress: async (address: string, network: string) => {
    const { data } = await api.post("/api/validate/address", {
      address,
      network,
    });
    return data;
  },

  // Wave 3: Coins list endpoint
  getCoins: async () => {
    const { data } = await api.get("/api/coins");
    return data;
  },

  getCoin: async (coin: string) => {
    const { data } = await api.get(`/api/coins/${coin}`);
    return data;
  },

  searchCoins: async (query: string) => {
    const { data } = await api.get(`/api/coins/search/${query}`);
    return data;
  },

  // Wave 3: Wallet balance endpoints
  getWalletBalance: async (chain: string, address: string) => {
    const { data } = await api.get(`/api/wallets/balance/${chain}/${address}`);
    return data;
  },

  getWalletBalances: async (address: string, chains?: string[]) => {
    const { data } = await api.post("/api/wallets/balances", {
      address,
      chains,
    });
    return data;
  },

  getWalletHealth: async (address: string) => {
    const { data } = await api.get(`/api/wallets/health/${address}`);
    return data;
  },

  // Wave 3: Gift endpoints
  createGift: async (params: {
    chain: string;
    settleAmount: string;
    settleAddress: string;
    message?: string;
    ttl?: number;
  }) => {
    const { data } = await api.post("/api/gifts", params);
    return data;
  },

  getGift: async (giftId: string) => {
    const { data } = await api.get(`/api/gifts/${giftId}`);
    return data;
  },

  // =====================================
  // WALLET AUTH ENDPOINTS
  // =====================================

  authGetNonce: async (walletAddress: string) => {
    const { data } = await api.post("/api/auth/nonce", { walletAddress });
    return data;
  },

  authVerify: async (params: {
    walletAddress: string;
    signature: string;
    referralCode?: string;
  }) => {
    const { data } = await api.post("/api/auth/verify", params);
    return data;
  },

  authCheckStatus: async (walletAddress: string) => {
    const { data } = await api.get(`/api/auth/check/${walletAddress}`);
    return data;
  },

  authGetMe: async (walletAddress: string) => {
    const { data } = await api.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${walletAddress}` },
    });
    return data;
  },

  authLogout: async (walletAddress: string) => {
    const { data } = await api.post(
      "/api/auth/logout",
      {},
      { headers: { Authorization: `Bearer ${walletAddress}` } }
    );
    return data;
  },

  // =====================================
  // REFERRAL ENDPOINTS
  // =====================================

  getReferralStats: async (walletAddress: string) => {
    const { data } = await api.get("/api/referrals", {
      headers: { Authorization: `Bearer ${walletAddress}` },
    });
    return data;
  },

  applyReferralCode: async (walletAddress: string, referralCode: string) => {
    const { data } = await api.post(
      "/api/referrals/apply",
      { referralCode },
      { headers: { Authorization: `Bearer ${walletAddress}` } }
    );
    return data;
  },

  checkReferralCode: async (code: string) => {
    const { data } = await api.get(`/api/referrals/code/${code}`);
    return data;
  },

  getReferralLinks: async (walletAddress: string) => {
    const { data } = await api.get("/api/referrals/link", {
      headers: { Authorization: `Bearer ${walletAddress}` },
    });
    return data;
  },

  getReferralLeaderboard: async (limit?: number) => {
    const { data } = await api.get(
      `/api/referrals/leaderboard${limit ? `?limit=${limit}` : ""}`
    );
    return data;
  },

  // =====================================
  // HISTORY ENDPOINTS
  // =====================================

  getHistory: async (
    walletAddress: string,
    params?: { type?: string; limit?: number; offset?: number }
  ) => {
    const { data } = await api.get("/api/history", {
      headers: { Authorization: `Bearer ${walletAddress}` },
      params,
    });
    return data;
  },

  getShiftHistory: async (
    walletAddress: string,
    params?: { limit?: number; offset?: number }
  ) => {
    const { data } = await api.get("/api/history/shifts", {
      headers: { Authorization: `Bearer ${walletAddress}` },
      params,
    });
    return data;
  },

  getHistoryStats: async (walletAddress: string) => {
    const { data } = await api.get("/api/history/stats", {
      headers: { Authorization: `Bearer ${walletAddress}` },
    });
    return data;
  },

  exportHistory: async (walletAddress: string) => {
    const { data } = await api.get("/api/history/export", {
      headers: { Authorization: `Bearer ${walletAddress}` },
    });
    return data;
  },

  getHistorySummary: async (walletAddress: string) => {
    const { data } = await api.get("/api/history/summary", {
      headers: { Authorization: `Bearer ${walletAddress}` },
    });
    return data;
  },
};

export default octaneAPI;
