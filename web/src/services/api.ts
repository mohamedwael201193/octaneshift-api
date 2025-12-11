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
};

export default octaneAPI;
