export interface NetworkInfo {
  alias: string;
  settleCoin: string;
  networkName: string;
  nativeCurrency: string;
  explorerUrl: string;
  chainId: number;
}

export const NETWORK_MAP: Record<string, NetworkInfo> = {
  // Ethereum
  eth: {
    alias: "eth",
    settleCoin: "eth-ethereum",
    networkName: "Ethereum",
    nativeCurrency: "ETH",
    explorerUrl: "https://etherscan.io",
    chainId: 1,
  },

  // Base
  base: {
    alias: "base",
    settleCoin: "eth-base",
    networkName: "Base",
    nativeCurrency: "ETH",
    explorerUrl: "https://basescan.org",
    chainId: 8453,
  },

  // Arbitrum
  arb: {
    alias: "arb",
    settleCoin: "eth-arbitrum",
    networkName: "Arbitrum",
    nativeCurrency: "ETH",
    explorerUrl: "https://arbiscan.io",
    chainId: 42161,
  },

  // Polygon (POL)
  pol: {
    alias: "pol",
    settleCoin: "pol-polygon",
    networkName: "Polygon",
    nativeCurrency: "POL",
    explorerUrl: "https://polygonscan.com",
    chainId: 137,
  },
  polygon: {
    alias: "polygon",
    settleCoin: "pol-polygon",
    networkName: "Polygon",
    nativeCurrency: "POL",
    explorerUrl: "https://polygonscan.com",
    chainId: 137,
  },
  // Legacy MATIC alias for backward compatibility
  matic: {
    alias: "matic",
    settleCoin: "pol-polygon",
    networkName: "Polygon",
    nativeCurrency: "POL",
    explorerUrl: "https://polygonscan.com",
    chainId: 137,
  },

  // Optimism
  op: {
    alias: "op",
    settleCoin: "eth-optimism",
    networkName: "Optimism",
    nativeCurrency: "ETH",
    explorerUrl: "https://optimistic.etherscan.io",
    chainId: 10,
  },

  // Avalanche
  avax: {
    alias: "avax",
    settleCoin: "avax-avalanche",
    networkName: "Avalanche",
    nativeCurrency: "AVAX",
    explorerUrl: "https://snowtrace.io",
    chainId: 43114,
  },
};

export function getNetworkByAlias(alias: string): NetworkInfo | null {
  return NETWORK_MAP[alias.toLowerCase()] || null;
}

export function getSupportedChains(): string[] {
  return Object.keys(NETWORK_MAP);
}

export function getExplorerLink(network: string, txHash: string): string {
  const networkInfo = getNetworkByAlias(network);
  if (!networkInfo) return "";
  return `${networkInfo.explorerUrl}/tx/${txHash}`;
}

export function getNetworkName(alias: string): string {
  const network = getNetworkByAlias(alias);
  return network?.networkName || alias.toUpperCase();
}
