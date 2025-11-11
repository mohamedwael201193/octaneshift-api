/**
 * Address validation utilities for different cryptocurrency networks
 */

import * as coinsCache from "../lib/coinsCache";

export interface ValidationResult {
  isValid: boolean;
  network?: string;
  format?: string;
  error?: string;
  requiresMemo?: boolean;
  memoHint?: string;
}

/**
 * Basic Ethereum address validation (0x followed by 40 hex characters)
 */
export function validateEthereumAddress(address: string): ValidationResult {
  // Remove any whitespace
  const cleanAddress = address.trim();

  // Check if it starts with 0x and has 42 characters total
  if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
    return {
      isValid: false,
      error:
        "Invalid Ethereum address format. Should be 0x followed by 40 hex characters.",
    };
  }

  return {
    isValid: true,
    network: "ethereum",
    format: "hex",
  };
}

/**
 * Basic Bitcoin address validation (supports Legacy, SegWit, and Bech32)
 */
export function validateBitcoinAddress(address: string): ValidationResult {
  const cleanAddress = address.trim();

  // Legacy P2PKH (starts with 1)
  if (/^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanAddress)) {
    return {
      isValid: true,
      network: "bitcoin",
      format: "legacy",
    };
  }

  // Legacy P2SH (starts with 3)
  if (/^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanAddress)) {
    return {
      isValid: true,
      network: "bitcoin",
      format: "p2sh",
    };
  }

  // Bech32 SegWit (starts with bc1)
  if (/^bc1[a-z0-9]{39,59}$/.test(cleanAddress)) {
    return {
      isValid: true,
      network: "bitcoin",
      format: "bech32",
    };
  }

  return {
    isValid: false,
    error: "Invalid Bitcoin address format. Should start with 1, 3, or bc1.",
  };
}

/**
 * Basic Solana address validation (base58 encoded, 32 bytes = 44 characters)
 */
export function validateSolanaAddress(address: string): ValidationResult {
  const cleanAddress = address.trim();

  // Solana addresses are base58 encoded and typically 44 characters
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(cleanAddress)) {
    return {
      isValid: false,
      error:
        "Invalid Solana address format. Should be 43-44 base58 characters.",
    };
  }

  return {
    isValid: true,
    network: "solana",
    format: "base58",
  };
}

/**
 * XRP (Ripple) address validation
 * Classic addresses start with 'r' and are 25-35 characters base58
 * X-addresses start with 'X' and include a tag
 */
export function validateXRPAddress(address: string): ValidationResult {
  const cleanAddress = address.trim();

  // Classic address format (starts with 'r')
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(cleanAddress)) {
    return {
      isValid: true,
      network: "ripple",
      format: "classic",
      requiresMemo: true,
      memoHint:
        "XRP requires a destination tag (memo). Make sure to include it if your exchange/wallet requires one.",
    };
  }

  // X-Address format (starts with 'X')
  if (/^X[1-9A-HJ-NP-Za-km-z]{46}$/.test(cleanAddress)) {
    return {
      isValid: true,
      network: "ripple",
      format: "x-address",
      requiresMemo: false,
      memoHint: "X-Address format includes the tag. No separate memo needed.",
    };
  }

  return {
    isValid: false,
    error:
      'Invalid XRP address format. Should start with "r" (classic) or "X" (X-address).',
  };
}

/**
 * Stellar (XLM) address validation
 * Addresses start with 'G' and are 56 characters
 */
export function validateStellarAddress(address: string): ValidationResult {
  const cleanAddress = address.trim();

  // Stellar addresses are 56 characters and start with 'G'
  if (!/^G[A-Z2-7]{55}$/.test(cleanAddress)) {
    return {
      isValid: false,
      error:
        'Invalid Stellar (XLM) address format. Should start with "G" and be 56 characters.',
    };
  }

  return {
    isValid: true,
    network: "stellar",
    format: "stellar",
    requiresMemo: true,
    memoHint:
      "Stellar requires a memo for exchange deposits. Make sure to include it if provided by your exchange.",
  };
}

/**
 * TRON (TRX) address validation
 * Addresses start with 'T' and are 34 characters base58
 */
export function validateTronAddress(address: string): ValidationResult {
  const cleanAddress = address.trim();

  // TRON addresses are 34 characters and start with 'T'
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanAddress)) {
    return {
      isValid: false,
      error:
        'Invalid TRON address format. Should start with "T" and be 34 characters.',
    };
  }

  return {
    isValid: true,
    network: "tron",
    format: "base58",
  };
}

/**
 * EOS address validation
 * EOS addresses are 12 characters (a-z, 1-5)
 */
export function validateEOSAddress(address: string): ValidationResult {
  const cleanAddress = address.trim();

  // EOS addresses are exactly 12 characters
  if (!/^[a-z1-5]{12}$/.test(cleanAddress)) {
    return {
      isValid: false,
      error:
        "Invalid EOS address format. Should be exactly 12 characters (lowercase a-z and numbers 1-5).",
    };
  }

  return {
    isValid: true,
    network: "eos",
    format: "eos-name",
    requiresMemo: true,
    memoHint:
      "EOS requires a memo for exchange deposits. Make sure to include it if provided.",
  };
}

/**
 * Validates an address based on the target network
 */
export function validateAddress(
  address: string,
  network: string,
  coinId?: string
): ValidationResult {
  if (!address || address.trim().length === 0) {
    return {
      isValid: false,
      error: "Address cannot be empty.",
    };
  }

  const normalizedNetwork = network.toLowerCase();

  // Check if memo is required using coinsCache
  let requiresMemo = false;
  let memoHint: string | undefined;

  if (coinId) {
    requiresMemo = coinsCache.requiresMemo(coinId, normalizedNetwork);
    if (requiresMemo) {
      memoHint = `This network requires a memo/tag. Make sure to include it when making your deposit.`;
    }
  }

  // XRP (Ripple)
  if (["xrp", "ripple"].includes(normalizedNetwork)) {
    return validateXRPAddress(address);
  }

  // Stellar (XLM)
  if (["xlm", "stellar"].includes(normalizedNetwork)) {
    return validateStellarAddress(address);
  }

  // TRON (TRX)
  if (["trx", "tron"].includes(normalizedNetwork)) {
    return validateTronAddress(address);
  }

  // EOS
  if (["eos"].includes(normalizedNetwork)) {
    return validateEOSAddress(address);
  }

  // Ethereum-compatible networks (ETH, Base, Arbitrum, Polygon, Optimism, BSC, Avalanche)
  if (
    [
      "eth",
      "base",
      "arb",
      "matic",
      "pol",
      "op",
      "bnb",
      "bsc",
      "avax",
      "avalanche",
      "ethereum",
      "arbitrum",
      "polygon",
      "optimism",
      "binance",
    ].includes(normalizedNetwork)
  ) {
    const result = validateEthereumAddress(address);
    if (requiresMemo) {
      return { ...result, requiresMemo, memoHint };
    }
    return result;
  }

  // Bitcoin networks
  if (["btc", "bitcoin"].includes(normalizedNetwork)) {
    return validateBitcoinAddress(address);
  }

  // Solana
  if (["sol", "solana"].includes(normalizedNetwork)) {
    return validateSolanaAddress(address);
  }

  // For unknown networks, do basic length and character validation
  const cleanAddress = address.trim();
  if (cleanAddress.length < 20 || cleanAddress.length > 100) {
    return {
      isValid: false,
      error: "Address length should be between 20-100 characters.",
    };
  }

  // Basic check for common invalid characters
  if (/[<>\"'&]/.test(cleanAddress)) {
    return {
      isValid: false,
      error: "Address contains invalid characters.",
    };
  }

  return {
    isValid: true,
    network: normalizedNetwork,
    format: "unknown",
    requiresMemo,
    memoHint,
  };
}

/**
 * Get user-friendly network name for address validation
 */
export function getNetworkDisplayName(network: string): string {
  const networkMap: Record<string, string> = {
    eth: "Ethereum",
    ethereum: "Ethereum",
    base: "Base",
    arb: "Arbitrum",
    arbitrum: "Arbitrum",
    matic: "Polygon",
    pol: "Polygon (POL)",
    polygon: "Polygon",
    op: "Optimism",
    optimism: "Optimism",
    btc: "Bitcoin",
    bitcoin: "Bitcoin",
    sol: "Solana",
    solana: "Solana",
    xrp: "XRP (Ripple)",
    ripple: "XRP (Ripple)",
    xlm: "Stellar (XLM)",
    stellar: "Stellar",
    trx: "TRON",
    tron: "TRON",
    eos: "EOS",
    bnb: "BNB Smart Chain",
    bsc: "BNB Smart Chain",
    avax: "Avalanche",
    avalanche: "Avalanche",
  };

  return networkMap[network.toLowerCase()] || network.toUpperCase();
}

/**
 * Get example address for a network
 */
export function getExampleAddress(network: string): string {
  const examples: Record<string, string> = {
    eth: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    ethereum: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    base: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    arb: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    arbitrum: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    matic: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    pol: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    polygon: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    op: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    optimism: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    btc: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    bitcoin: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    sol: "11111111111111111111111111111112",
    solana: "11111111111111111111111111111112",
    xrp: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv",
    ripple: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv",
    xlm: "GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK",
    stellar: "GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK",
    trx: "TRX9ZNdfjF3NRLHxNgjGhWSnxKJCdL3FJj",
    tron: "TRX9ZNdfjF3NRLHxNgjGhWSnxKJCdL3FJj",
    eos: "eosio.token",
    bnb: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    bsc: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    avax: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
    avalanche: "0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1",
  };

  return examples[network.toLowerCase()] || "Enter your wallet address";
}
