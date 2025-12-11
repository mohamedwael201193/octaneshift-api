import { IconType } from "react-icons";
import { FaBitcoin, FaEthereum } from "react-icons/fa";
import { SiPolygon } from "react-icons/si";

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
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    icon: FaEthereum,
    color: "#627EEA",
    apiCode: "eth-ethereum",
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18,
  },
  {
    id: "base",
    name: "Base",
    symbol: "ETH",
    icon: FaEthereum,
    color: "#0052FF",
    apiCode: "eth-base",
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18,
  },
  {
    id: "arb",
    name: "Arbitrum",
    symbol: "ETH",
    icon: FaEthereum,
    color: "#28A0F0",
    apiCode: "eth-arbitrum",
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18,
  },
  {
    id: "pol",
    name: "Polygon",
    symbol: "POL",
    icon: SiPolygon,
    color: "#8247E5",
    apiCode: "pol-polygon",
    minAmount: 1,
    maxAmount: 10000,
    decimals: 18,
  },
  {
    id: "op",
    name: "Optimism",
    symbol: "ETH",
    icon: FaEthereum,
    color: "#FF0420",
    apiCode: "eth-optimism",
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18,
  },
  {
    id: "avax",
    name: "Avalanche",
    symbol: "AVAX",
    icon: FaEthereum,
    color: "#E84142",
    apiCode: "avax-avalanche",
    minAmount: 0.1,
    maxAmount: 100,
    decimals: 18,
  },
  {
    id: "bsc",
    name: "BNB Chain",
    symbol: "BNB",
    icon: FaEthereum,
    color: "#F3BA2F",
    apiCode: "bnb-bsc",
    minAmount: 0.01,
    maxAmount: 100,
    decimals: 18,
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    icon: FaEthereum,
    color: "#9945FF",
    apiCode: "sol-solana",
    minAmount: 0.1,
    maxAmount: 1000,
    decimals: 9,
  },
  {
    id: "ftm",
    name: "Fantom",
    symbol: "FTM",
    icon: FaEthereum,
    color: "#1969FF",
    apiCode: "ftm-fantom",
    minAmount: 1,
    maxAmount: 10000,
    decimals: 18,
  },
  {
    id: "zksync",
    name: "zkSync Era",
    symbol: "ETH",
    icon: FaEthereum,
    color: "#8C8DFC",
    apiCode: "eth-zksync",
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18,
  },
  {
    id: "linea",
    name: "Linea",
    symbol: "ETH",
    icon: FaEthereum,
    color: "#61DFFF",
    apiCode: "eth-linea",
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18,
  },
  {
    id: "scroll",
    name: "Scroll",
    symbol: "ETH",
    icon: FaEthereum,
    color: "#FFEEDA",
    apiCode: "eth-scroll",
    minAmount: 0.001,
    maxAmount: 10,
    decimals: 18,
  },
];

export const DEPOSIT_TOKENS: DepositToken[] = [
  {
    symbol: "USDT",
    name: "Tether",
    networks: [
      "ethereum",
      "polygon",
      "bsc",
      "tron",
      "arbitrum",
      "optimism",
      "avalanche",
    ],
    icon: "💵",
    color: "#26A17B",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    networks: [
      "ethereum",
      "base",
      "polygon",
      "arbitrum",
      "optimism",
      "avalanche",
      "solana",
    ],
    icon: "💵",
    color: "#2775CA",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    networks: ["ethereum", "arbitrum", "optimism", "base", "zksync", "linea"],
    icon: FaEthereum,
    color: "#627EEA",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    networks: ["bitcoin"],
    icon: FaBitcoin,
    color: "#F7931A",
  },
  {
    symbol: "SOL",
    name: "Solana",
    networks: ["solana"],
    icon: FaEthereum,
    color: "#9945FF",
  },
  {
    symbol: "BNB",
    name: "BNB",
    networks: ["bsc"],
    icon: FaEthereum,
    color: "#F3BA2F",
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    networks: ["avalanche"],
    icon: FaEthereum,
    color: "#E84142",
  },
  {
    symbol: "POL",
    name: "Polygon",
    networks: ["polygon"],
    icon: SiPolygon,
    color: "#8247E5",
  },
  {
    symbol: "DAI",
    name: "Dai",
    networks: ["ethereum", "polygon", "arbitrum", "optimism"],
    icon: "💵",
    color: "#F5AC37",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    networks: ["ethereum", "polygon", "arbitrum"],
    icon: FaBitcoin,
    color: "#F7931A",
  },
  {
    symbol: "XRP",
    name: "XRP",
    networks: ["ripple"],
    icon: FaEthereum,
    color: "#23292F",
  },
  {
    symbol: "LTC",
    name: "Litecoin",
    networks: ["litecoin"],
    icon: FaEthereum,
    color: "#BFBBBB",
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    networks: ["dogecoin"],
    icon: FaEthereum,
    color: "#C2A633",
  },
];
