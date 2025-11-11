import { FaEthereum, FaBitcoin } from 'react-icons/fa';
import { SiPolygon } from 'react-icons/si';
import { IconType } from 'react-icons';

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  icon: IconType;
  color: string;
  apiCode: string;
  minAmount: number;
  maxAmount: number;
  decimals: number;
}

export interface DepositToken {
  symbol: string;
  name: string;
  networks: string[];
  icon: IconType | string;
  color: string;
}

export const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    icon: FaEthereum,
    color: '#627EEA',
    apiCode: 'eth-ethereum',
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18
  },
  {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    icon: FaEthereum,
    color: '#0052FF',
    apiCode: 'eth-base',
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18
  },
  {
    id: 'arb',
    name: 'Arbitrum',
    symbol: 'ETH',
    icon: FaEthereum,
    color: '#28A0F0',
    apiCode: 'eth-arbitrum',
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18
  },
  {
    id: 'matic',
    name: 'Polygon',
    symbol: 'MATIC',
    icon: SiPolygon,
    color: '#8247E5',
    apiCode: 'matic-polygon',
    minAmount: 1,
    maxAmount: 10000,
    decimals: 18
  },
  {
    id: 'op',
    name: 'Optimism',
    symbol: 'ETH',
    icon: FaEthereum,
    color: '#FF0420',
    apiCode: 'eth-optimism',
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18
  },
  {
    id: 'avax',
    name: 'Avalanche',
    symbol: 'AVAX',
    icon: FaEthereum,
    color: '#E84142',
    apiCode: 'avax-avalanche',
    minAmount: 0.1,
    maxAmount: 100,
    decimals: 18
  }
];

export const DEPOSIT_TOKENS: DepositToken[] = [
  {
    symbol: 'USDT',
    name: 'Tether',
    networks: ['ethereum', 'polygon'],
    icon: '💵',
    color: '#26A17B'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    networks: ['ethereum', 'base'],
    icon: '💵',
    color: '#2775CA'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    networks: ['ethereum'],
    icon: FaEthereum,
    color: '#627EEA'
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    networks: ['bitcoin'],
    icon: FaBitcoin,
    color: '#F7931A'
  }
];
