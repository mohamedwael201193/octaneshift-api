import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { rateLimitConfig } from "../middleware/rateLimit";
import { logger } from "../utils/logger";

const router = Router();

// Validation schemas
const AddressValidationSchema = z.object({
  address: z.string().min(1, "Address is required"),
  network: z.string().min(1, "Network is required"),
});

// Address format patterns for different networks
const ADDRESS_PATTERNS: Record<
  string,
  { regex: RegExp; hint: string; example: string }
> = {
  // Bitcoin & variants
  bitcoin: {
    regex: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/,
    hint: "Bitcoin address should start with 1, 3, or bc1",
    example: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  },
  litecoin: {
    regex: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
    hint: "Litecoin address should start with L, M, or 3",
    example: "LWLc8xbC3ENRnLmcPKKn1vMn1VHheZGWzq",
  },
  dogecoin: {
    regex: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/,
    hint: "Dogecoin address should start with D",
    example: "DNmQcWvxfNuCdELFVNjT8aJW1XFdz4F1vE",
  },
  dash: {
    regex: /^X[1-9A-HJ-NP-Za-km-z]{33}$/,
    hint: "Dash address should start with X",
    example: "XoPhKPKsxQ1Y1YBNXWRpNjX9fLcPHLWt2p",
  },

  // EVM chains (Ethereum, Polygon, BSC, Arbitrum, etc.)
  ethereum: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "Ethereum address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  polygon: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "Polygon address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  arbitrum: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "Arbitrum address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  optimism: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "Optimism address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  base: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "Base address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  bsc: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "BSC address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  avalanche: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "Avalanche C-Chain address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  fantom: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "Fantom address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },
  zksync: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    hint: "zkSync address should start with 0x followed by 40 hex characters",
    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE0f",
  },

  // Solana
  solana: {
    regex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    hint: "Solana address should be 32-44 base58 characters",
    example: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  },

  // Ripple
  ripple: {
    regex: /^r[0-9a-zA-Z]{24,34}$/,
    hint: "XRP address should start with 'r'",
    example: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  },

  // Stellar
  stellar: {
    regex: /^G[A-Z2-7]{55}$/,
    hint: "Stellar address should start with 'G'",
    example: "GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A",
  },

  // Tron
  tron: {
    regex: /^T[a-zA-Z0-9]{33}$/,
    hint: "Tron address should start with 'T'",
    example: "TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW",
  },

  // Cosmos/Atom
  cosmos: {
    regex: /^cosmos[a-z0-9]{38,45}$/,
    hint: "Cosmos address should start with 'cosmos'",
    example: "cosmos1vqpjljwsynsn58dugz0w8ut7kun7t8ls2qkmsq",
  },

  // Polkadot
  polkadot: {
    regex: /^[1-9A-HJ-NP-Za-km-z]{47,48}$/,
    hint: "Polkadot address should be 47-48 characters",
    example: "1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg",
  },

  // Near
  near: {
    regex: /^[a-z0-9_-]{2,64}\.near$|^[a-fA-F0-9]{64}$/,
    hint: "NEAR address should end with .near or be a 64-character hex string",
    example: "example.near",
  },

  // Cardano
  cardano: {
    regex: /^addr1[a-z0-9]{98}$/,
    hint: "Cardano Shelley address should start with 'addr1'",
    example:
      "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
  },

  // Algorand
  algorand: {
    regex: /^[A-Z2-7]{58}$/,
    hint: "Algorand address should be 58 characters",
    example: "VCMJKWOY5P5P7SKMZFFOCEROPJCZOTIJMNIYNUCKH7LRO45JMJP6UYBIJA",
  },

  // Aptos
  aptos: {
    regex: /^0x[a-fA-F0-9]{64}$/,
    hint: "Aptos address should start with 0x followed by 64 hex characters",
    example:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  },

  // Sui
  sui: {
    regex: /^0x[a-fA-F0-9]{64}$/,
    hint: "Sui address should start with 0x followed by 64 hex characters",
    example:
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  },

  // TON
  ton: {
    regex: /^(EQ|UQ)[a-zA-Z0-9_-]{46}$/,
    hint: "TON address should start with 'EQ' or 'UQ'",
    example: "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG",
  },

  // Monero
  monero: {
    regex: /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,
    hint: "Monero address should start with '4' and be 95 characters",
    example:
      "4AdUndXHHZ6cfufTMvppY6JwXNouMBzSkbLYfpAV5Usx3skxNgYeYTRj5UzqtReoS44qo9mtmXCqY45DJ852K5Jv2684Rge",
  },
};

// Network aliases (map common names to standard patterns)
const NETWORK_ALIASES: Record<string, string> = {
  eth: "ethereum",
  matic: "polygon",
  pol: "polygon",
  arb: "arbitrum",
  op: "optimism",
  avax: "avalanche",
  ftm: "fantom",
  sol: "solana",
  xrp: "ripple",
  xlm: "stellar",
  trx: "tron",
  atom: "cosmos",
  dot: "polkadot",
  ada: "cardano",
  algo: "algorand",
  apt: "aptos",
  btc: "bitcoin",
  ltc: "litecoin",
  doge: "dogecoin",
  xmr: "monero",
};

/**
 * Validate an address for a specific network
 */
function validateAddress(
  address: string,
  network: string
): { valid: boolean; hint: string; format: string; example: string } {
  // Normalize network name
  const normalizedNetwork =
    NETWORK_ALIASES[network.toLowerCase()] || network.toLowerCase();

  // Check if we have a pattern for this network
  const pattern = ADDRESS_PATTERNS[normalizedNetwork];

  if (!pattern) {
    // Unknown network - do basic validation
    if (address.length < 10) {
      return {
        valid: false,
        hint: "Address is too short",
        format: "unknown",
        example: "",
      };
    }
    return {
      valid: true,
      hint: "Network-specific validation not available. Please verify manually.",
      format: "unknown",
      example: "",
    };
  }

  // Test address against pattern
  const isValid = pattern.regex.test(address);

  return {
    valid: isValid,
    hint: isValid ? "Address format is valid" : pattern.hint,
    format: normalizedNetwork,
    example: pattern.example,
  };
}

/**
 * POST /api/validate/address
 * Validate a blockchain address for a specific network
 */
router.post(
  "/address",
  rateLimitConfig.general,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { address, network } = AddressValidationSchema.parse(req.body);

      const result = validateAddress(address, network);

      logger.debug(
        {
          address: address.substring(0, 10) + "...",
          network,
          valid: result.valid,
        },
        "Address validation"
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation error",
          details: error.errors,
        });
        return;
      }
      logger.error({ error }, "Error validating address");
      next(error);
    }
  }
);

/**
 * GET /api/validate/networks
 * Get list of supported networks for validation
 */
router.get(
  "/networks",
  rateLimitConfig.general,
  (_req: Request, res: Response): void => {
    const networks = Object.keys(ADDRESS_PATTERNS).map((network) => ({
      network,
      example: ADDRESS_PATTERNS[network].example,
      hint: ADDRESS_PATTERNS[network].hint,
    }));

    res.json({
      success: true,
      data: networks,
      count: networks.length,
      aliases: NETWORK_ALIASES,
    });
  }
);

/**
 * GET /api/validate/address/:network/:address
 * Quick address validation via GET request
 */
router.get(
  "/address/:network/:address",
  rateLimitConfig.general,
  (req: Request, res: Response): void => {
    const { network, address } = req.params;

    if (!address || !network) {
      res.status(400).json({
        success: false,
        error: "Both network and address are required",
      });
      return;
    }

    const result = validateAddress(address, network);

    res.json({
      success: true,
      data: result,
    });
  }
);

export default router;
