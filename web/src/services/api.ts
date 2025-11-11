import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'https://octaneshift-api-1.onrender.com';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      toast.error('Service not available in your region');
    } else if (error.response?.status === 404) {
      toast.error('Not found');
    } else {
      toast.error(error.response?.data?.message || 'An error occurred');
    }
    return Promise.reject(error);
  }
);

export const octaneAPI = {
  getHealth: async () => {
    const { data } = await api.get('/health');
    return data;
  },

  getBotStatus: async () => {
    const { data } = await api.get('/api/bot/status');
    return data;
  },

  getPermissions: async () => {
    const { data } = await api.get('/api/permissions');
    return data;
  },

  getQuote: async (from: string, to: string, amount?: string) => {
    const params = new URLSearchParams();
    params.append('from', from);
    params.append('to', to);
    if (amount) params.append('amount', amount);

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
    const { data } = await api.post('/api/shifts/variable', shiftData);
    return data;
  },

  getShift: async (shiftId: string) => {
    const { data } = await api.get(`/api/shifts/${shiftId}`);
    return data;
  },

  testSideShift: async () => {
    const { data } = await api.get('/api/test/sideshift-health');
    return data;
  }
};

export default octaneAPI;
