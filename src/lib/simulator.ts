/**
 * Phase G: Regional Gating & Simulator Mode
 *
 * Handles regional restrictions and provides realistic simulation
 * when users from restricted regions attempt to create shifts.
 */

import { randomBytes } from "crypto";
import { logger } from "../utils/logger";

/**
 * Generate a fake shift ID that looks realistic
 */
function generateFakeShiftId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Generate a fake deposit address for a given coin/network
 */
function generateFakeDepositAddress(_coin: string, network: string): string {
  // Common address patterns by network
  const patterns: Record<string, () => string> = {
    // Bitcoin-like addresses
    bitcoin: () => {
      const prefix = Math.random() > 0.5 ? "bc1" : "1";
      return prefix + randomBytes(20).toString("hex").substring(0, 34);
    },
    litecoin: () => "L" + randomBytes(16).toString("hex").substring(0, 33),
    dogecoin: () => "D" + randomBytes(16).toString("hex").substring(0, 33),

    // Ethereum-like addresses
    ethereum: () => "0x" + randomBytes(20).toString("hex"),
    polygon: () => "0x" + randomBytes(20).toString("hex"),
    arbitrum: () => "0x" + randomBytes(20).toString("hex"),
    optimism: () => "0x" + randomBytes(20).toString("hex"),
    bsc: () => "0x" + randomBytes(20).toString("hex"),

    // Solana
    solana: () => randomBytes(32).toString("base64").substring(0, 44),

    // Ripple
    ripple: () => "r" + randomBytes(16).toString("hex").substring(0, 33),

    // Stellar
    stellar: () =>
      "G" + randomBytes(28).toString("hex").substring(0, 55).toUpperCase(),

    // Tron
    tron: () => "T" + randomBytes(16).toString("hex").substring(0, 33),

    // Monero
    monero: () => "4" + randomBytes(48).toString("hex").substring(0, 94),
  };

  // Try to find matching pattern
  const pattern = patterns[network.toLowerCase()];
  if (pattern) {
    return pattern();
  }

  // Default: hex address
  return "0x" + randomBytes(20).toString("hex");
}

/**
 * Calculate realistic amounts based on input
 */
function calculateSimulatedAmounts(params: {
  type: "fixed" | "variable";
  depositCoin: string;
  settleCoin: string;
  depositAmount?: string;
  settleAmount?: string;
}) {
  const { type, depositAmount, settleAmount } = params;

  if (type === "fixed" && settleAmount) {
    // Fixed: we know settle amount, estimate deposit
    const settleNum = parseFloat(settleAmount);
    const estimatedRate = 0.98; // Assume ~2% fee
    const depositNum = settleNum / estimatedRate;
    return {
      depositAmount: depositNum.toFixed(8),
      settleAmount,
    };
  } else if (depositAmount) {
    // Variable: we know deposit, estimate settle
    const depositNum = parseFloat(depositAmount);
    const estimatedRate = 0.98;
    const settleNum = depositNum * estimatedRate;
    return {
      depositAmount,
      settleAmount: settleNum.toFixed(8),
    };
  }

  // Fallback: use placeholder values
  return {
    depositAmount: "0.01",
    settleAmount: "0.0098",
  };
}

/**
 * Create a simulated fixed shift response
 */
export function createSimulatedFixedShift(params: {
  userId: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  settleAmount: string;
  settleAddress: string;
  settleMemo?: string;
  refundAddress?: string;
  refundMemo?: string;
}) {
  const shiftId = generateFakeShiftId();
  const depositAddress = generateFakeDepositAddress(
    params.depositCoin,
    params.depositNetwork
  );

  const amounts = calculateSimulatedAmounts({
    type: "fixed",
    depositCoin: params.depositCoin,
    settleCoin: params.settleCoin,
    settleAmount: params.settleAmount,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  logger.info(
    {
      userId: params.userId,
      shiftId,
      depositCoin: params.depositCoin,
      settleCoin: params.settleCoin,
      simulated: true,
    },
    "Created simulated fixed shift"
  );

  return {
    id: shiftId,
    type: "fixed" as const,
    createdAt: now.toISOString(),
    depositCoin: params.depositCoin,
    depositNetwork: params.depositNetwork,
    depositAddress,
    depositAmount: amounts.depositAmount,
    depositMin: amounts.depositAmount,
    depositMax: amounts.depositAmount,
    settleCoin: params.settleCoin,
    settleNetwork: params.settleNetwork,
    settleAddress: params.settleAddress,
    settleAmount: amounts.settleAmount,
    status: "waiting" as const,
    expiresAt: expiresAt.toISOString(),
    rate: (
      parseFloat(amounts.settleAmount) / parseFloat(amounts.depositAmount)
    ).toFixed(8),
    // Additional fields from SideShift API
    ...(params.settleMemo && { settleMemo: params.settleMemo }),
    ...(params.refundAddress && { refundAddress: params.refundAddress }),
    ...(params.refundMemo && { refundMemo: params.refundMemo }),
    // Simulator metadata
    __simulator: true,
    __simulatorWarning:
      "⚠️ SIMULATED - This shift is not real. Service unavailable in your region.",
  };
}

/**
 * Create a simulated variable shift response
 */
export function createSimulatedVariableShift(params: {
  userId: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  settleAddress: string;
  settleMemo?: string;
  refundAddress?: string;
  refundMemo?: string;
}) {
  const shiftId = generateFakeShiftId();
  const depositAddress = generateFakeDepositAddress(
    params.depositCoin,
    params.depositNetwork
  );

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  // Variable rates change, provide estimated range
  const amounts = {
    depositMin: "0.001",
    depositMax: "10.0",
    estimatedRate: "0.98",
  };

  logger.info(
    {
      userId: params.userId,
      shiftId,
      depositCoin: params.depositCoin,
      settleCoin: params.settleCoin,
      simulated: true,
    },
    "Created simulated variable shift"
  );

  return {
    id: shiftId,
    type: "variable" as const,
    createdAt: now.toISOString(),
    depositCoin: params.depositCoin,
    depositNetwork: params.depositNetwork,
    depositAddress,
    depositMin: amounts.depositMin,
    depositMax: amounts.depositMax,
    settleCoin: params.settleCoin,
    settleNetwork: params.settleNetwork,
    settleAddress: params.settleAddress,
    status: "waiting" as const,
    expiresAt: expiresAt.toISOString(),
    rate: amounts.estimatedRate,
    // Additional fields
    ...(params.settleMemo && { settleMemo: params.settleMemo }),
    ...(params.refundAddress && { refundAddress: params.refundAddress }),
    ...(params.refundMemo && { refundMemo: params.refundMemo }),
    // Simulator metadata
    __simulator: true,
    __simulatorWarning:
      "⚠️ SIMULATED - This shift is not real. Service unavailable in your region.",
  };
}

/**
 * Create a simulated fixed quote response
 */
export function createSimulatedFixedQuote(params: {
  userId: string;
  depositCoin: string;
  depositNetwork: string;
  settleCoin: string;
  settleNetwork: string;
  settleAmount: string;
}) {
  const quoteId = generateFakeShiftId();

  const amounts = calculateSimulatedAmounts({
    type: "fixed",
    depositCoin: params.depositCoin,
    settleCoin: params.settleCoin,
    settleAmount: params.settleAmount,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  logger.info(
    {
      userId: params.userId,
      quoteId,
      depositCoin: params.depositCoin,
      settleCoin: params.settleCoin,
      simulated: true,
    },
    "Created simulated fixed quote"
  );

  return {
    id: quoteId,
    createdAt: now.toISOString(),
    depositCoin: params.depositCoin,
    depositNetwork: params.depositNetwork,
    depositAmount: amounts.depositAmount,
    settleCoin: params.settleCoin,
    settleNetwork: params.settleNetwork,
    settleAmount: amounts.settleAmount,
    expiresAt: expiresAt.toISOString(),
    rate: (
      parseFloat(amounts.settleAmount) / parseFloat(amounts.depositAmount)
    ).toFixed(8),
    // Simulator metadata
    __simulator: true,
    __simulatorWarning:
      "⚠️ SIMULATED - This quote is not real. Service unavailable in your region.",
  };
}

/**
 * Check if user is in a restricted region
 * Returns whether simulator mode should be enabled
 */
export async function checkRegionalRestrictions(
  sideshiftClient: any,
  userIp?: string
): Promise<{
  allowed: boolean;
  simulatorMode: boolean;
  permissions?: any;
}> {
  try {
    const permissions = await sideshiftClient.getPermissions(userIp);

    if (!permissions.createShift) {
      logger.warn(
        {
          userIp,
          permissions,
        },
        "User in restricted region - enabling simulator mode"
      );

      return {
        allowed: false,
        simulatorMode: true,
        permissions,
      };
    }

    return {
      allowed: true,
      simulatorMode: false,
      permissions,
    };
  } catch (error: any) {
    logger.error(
      {
        error,
        userIp,
      },
      "Failed to check permissions, allowing by default"
    );

    // On error, allow the request to proceed (fail open)
    return {
      allowed: true,
      simulatorMode: false,
    };
  }
}
