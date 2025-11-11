import { JsonRpcProvider } from "ethers";
import { logger } from "../utils/logger";

export type ChainAlias = "eth" | "base" | "arb" | "op" | "pol" | "avax";

export interface ChainConfig {
  alias: ChainAlias;
  name: string;
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  explorerUrl: string;
}

// Default public RPC endpoints (with warning logged)
const DEFAULT_RPCS: Record<ChainAlias, string> = {
  eth: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  arb: "https://arb1.arbitrum.io/rpc",
  op: "https://mainnet.optimism.io",
  pol: "https://polygon-rpc.com",
  avax: "https://api.avax.network/ext/bc/C/rpc",
};

export const NETWORK_MAP: Record<ChainAlias, ChainConfig> = {
  eth: {
    alias: "eth",
    name: "Ethereum",
    chainId: 1,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: DEFAULT_RPCS.eth,
    explorerUrl: "https://etherscan.io",
  },
  base: {
    alias: "base",
    name: "Base",
    chainId: 8453,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: DEFAULT_RPCS.base,
    explorerUrl: "https://basescan.org",
  },
  arb: {
    alias: "arb",
    name: "Arbitrum One",
    chainId: 42161,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: DEFAULT_RPCS.arb,
    explorerUrl: "https://arbiscan.io",
  },
  op: {
    alias: "op",
    name: "Optimism",
    chainId: 10,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: DEFAULT_RPCS.op,
    explorerUrl: "https://optimistic.etherscan.io",
  },
  pol: {
    alias: "pol",
    name: "Polygon",
    chainId: 137,
    nativeCurrency: {
      name: "POL",
      symbol: "POL",
      decimals: 18,
    },
    rpcUrl: DEFAULT_RPCS.pol,
    explorerUrl: "https://polygonscan.com",
  },
  avax: {
    alias: "avax",
    name: "Avalanche C-Chain",
    chainId: 43114,
    nativeCurrency: {
      name: "Avalanche",
      symbol: "AVAX",
      decimals: 18,
    },
    rpcUrl: DEFAULT_RPCS.avax,
    explorerUrl: "https://snowtrace.io",
  },
};

// Load custom RPC URLs from environment
function loadCustomRpcs(): Partial<Record<ChainAlias, string>> {
  const customRpcs: Partial<Record<ChainAlias, string>> = {};

  try {
    const rpcJson = process.env.PROVIDER_RPC_URLS_JSON;
    if (rpcJson) {
      const parsed = JSON.parse(rpcJson);
      Object.keys(parsed).forEach((key) => {
        if (key in NETWORK_MAP) {
          customRpcs[key as ChainAlias] = parsed[key];
        }
      });
      logger.info(
        { chains: Object.keys(customRpcs) },
        "Loaded custom RPC URLs from env"
      );
    } else {
      logger.warn("PROVIDER_RPC_URLS_JSON not set, using public RPC endpoints");
    }
  } catch (error) {
    logger.error(
      { error },
      "Failed to parse PROVIDER_RPC_URLS_JSON, using defaults"
    );
  }

  return customRpcs;
}

// Initialize providers
const customRpcs = loadCustomRpcs();
const providers: Record<ChainAlias, JsonRpcProvider> = {} as Record<
  ChainAlias,
  JsonRpcProvider
>;

// Create providers for each chain
Object.keys(NETWORK_MAP).forEach((alias) => {
  const chainAlias = alias as ChainAlias;
  const config = NETWORK_MAP[chainAlias];
  const rpcUrl = customRpcs[chainAlias] || config.rpcUrl;

  // Update config with custom RPC if provided
  config.rpcUrl = rpcUrl;

  // Create provider
  providers[chainAlias] = new JsonRpcProvider(rpcUrl, {
    chainId: config.chainId,
    name: config.name,
  });
});

/**
 * Basic EVM address validation (0x followed by 40 hex characters)
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

/**
 * Get native balance for an address on a specific chain
 * @param chainAlias Chain alias (eth, base, arb, op, pol, avax)
 * @param address Ethereum address to check
 * @returns Balance as bigint (in wei for ETH-like chains)
 */
export async function getNativeBalance(
  chainAlias: ChainAlias,
  address: string
): Promise<bigint> {
  // Validate address format
  if (!isValidEvmAddress(address)) {
    throw new Error(`Invalid address format: ${address}`);
  }

  // Get provider for chain
  const provider = providers[chainAlias];
  if (!provider) {
    throw new Error(`No provider configured for chain: ${chainAlias}`);
  }

  try {
    // Fetch balance
    const balance = await provider.getBalance(address);

    logger.debug(
      {
        chain: chainAlias,
        address,
        balance: balance.toString(),
      },
      "Fetched native balance"
    );

    return balance;
  } catch (error) {
    logger.error(
      {
        error,
        chain: chainAlias,
        address,
      },
      "Failed to fetch native balance"
    );
    throw error;
  }
}

/**
 * Get provider for a specific chain
 */
export function getProvider(chainAlias: ChainAlias): JsonRpcProvider {
  const provider = providers[chainAlias];
  if (!provider) {
    throw new Error(`No provider configured for chain: ${chainAlias}`);
  }
  return provider;
}

/**
 * Get chain configuration
 */
export function getChainConfig(chainAlias: ChainAlias): ChainConfig {
  const config = NETWORK_MAP[chainAlias];
  if (!config) {
    throw new Error(`Unknown chain alias: ${chainAlias}`);
  }
  return config;
}

/**
 * Get all supported chain aliases
 */
export function getSupportedChains(): ChainAlias[] {
  return Object.keys(NETWORK_MAP) as ChainAlias[];
}

/**
 * Format balance from wei to human-readable format
 */
export function formatBalance(balance: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const remainder = balance % divisor;

  // Format with appropriate decimal places
  const remainderStr = remainder.toString().padStart(decimals, "0");
  const formatted = `${whole}.${remainderStr.slice(0, 6)}`;

  // Remove trailing zeros
  return formatted.replace(/\.?0+$/, "");
}

export default {
  NETWORK_MAP,
  getNativeBalance,
  getProvider,
  getChainConfig,
  getSupportedChains,
  isValidEvmAddress,
  formatBalance,
};
