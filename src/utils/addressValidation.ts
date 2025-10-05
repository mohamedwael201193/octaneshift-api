/**
 * Address validation utilities for different cryptocurrency networks
 */

export interface ValidationResult {
  isValid: boolean;
  network?: string;
  format?: string;
  error?: string;
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
      error: 'Invalid Ethereum address format. Should be 0x followed by 40 hex characters.'
    };
  }
  
  return {
    isValid: true,
    network: 'ethereum',
    format: 'hex'
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
      network: 'bitcoin',
      format: 'legacy'
    };
  }
  
  // Legacy P2SH (starts with 3)
  if (/^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(cleanAddress)) {
    return {
      isValid: true,
      network: 'bitcoin',
      format: 'p2sh'
    };
  }
  
  // Bech32 SegWit (starts with bc1)
  if (/^bc1[a-z0-9]{39,59}$/.test(cleanAddress)) {
    return {
      isValid: true,
      network: 'bitcoin',
      format: 'bech32'
    };
  }
  
  return {
    isValid: false,
    error: 'Invalid Bitcoin address format. Should start with 1, 3, or bc1.'
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
      error: 'Invalid Solana address format. Should be 43-44 base58 characters.'
    };
  }
  
  return {
    isValid: true,
    network: 'solana',
    format: 'base58'
  };
}

/**
 * Validates an address based on the target network
 */
export function validateAddress(address: string, network: string): ValidationResult {
  if (!address || address.trim().length === 0) {
    return {
      isValid: false,
      error: 'Address cannot be empty.'
    };
  }
  
  const normalizedNetwork = network.toLowerCase();
  
  // Ethereum-compatible networks (ETH, Base, Arbitrum, Polygon, Optimism)
  if (['eth', 'base', 'arb', 'matic', 'op', 'ethereum', 'arbitrum', 'polygon', 'optimism'].includes(normalizedNetwork)) {
    return validateEthereumAddress(address);
  }
  
  // Bitcoin networks
  if (['btc', 'bitcoin'].includes(normalizedNetwork)) {
    return validateBitcoinAddress(address);
  }
  
  // Solana
  if (['sol', 'solana'].includes(normalizedNetwork)) {
    return validateSolanaAddress(address);
  }
  
  // For unknown networks, do basic length and character validation
  const cleanAddress = address.trim();
  if (cleanAddress.length < 20 || cleanAddress.length > 100) {
    return {
      isValid: false,
      error: 'Address length should be between 20-100 characters.'
    };
  }
  
  // Basic check for common invalid characters
  if (/[<>\"'&]/.test(cleanAddress)) {
    return {
      isValid: false,
      error: 'Address contains invalid characters.'
    };
  }
  
  return {
    isValid: true,
    network: normalizedNetwork,
    format: 'unknown'
  };
}

/**
 * Get user-friendly network name for address validation
 */
export function getNetworkDisplayName(network: string): string {
  const networkMap: Record<string, string> = {
    'eth': 'Ethereum',
    'ethereum': 'Ethereum',
    'base': 'Base',
    'arb': 'Arbitrum',
    'arbitrum': 'Arbitrum',
    'matic': 'Polygon',
    'polygon': 'Polygon',
    'op': 'Optimism',
    'optimism': 'Optimism',
    'btc': 'Bitcoin',
    'bitcoin': 'Bitcoin',
    'sol': 'Solana',
    'solana': 'Solana'
  };
  
  return networkMap[network.toLowerCase()] || network.toUpperCase();
}

/**
 * Get example address for a network
 */
export function getExampleAddress(network: string): string {
  const examples: Record<string, string> = {
    'eth': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'ethereum': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'base': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'arb': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'arbitrum': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'matic': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'polygon': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'op': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'optimism': '0x742d35cc6634C0532925a3b8D431ED81C31Bb3E1',
    'btc': '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    'bitcoin': '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    'sol': '11111111111111111111111111111112',
    'solana': '11111111111111111111111111111112'
  };
  
  return examples[network.toLowerCase()] || 'Enter your wallet address';
}