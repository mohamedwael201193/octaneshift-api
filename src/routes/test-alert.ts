import { Router } from "express";
import { logger } from "../utils/logger";

const router = Router();

/**
 * POST /api/test-alert
 * Send a test watchlist alert to demonstrate monitoring + deep link flow
 * This allows judges to test the entire alert → deep link workflow
 */
router.post("/", async (_req, res) => {
  try {
    logger.info("Test alert triggered");

    // Simulate a low gas balance scenario
    const testWalletAddress = "0xTestWallet123456789";
    const testChain = "base";
    const currentBalance = "0.0001"; // Very low ETH balance
    const threshold = "0.001"; // Alert threshold

    // Create a test deep link for the alert
    const deepLinkParams = new URLSearchParams({
      chain: testChain,
      amount: "5", // Suggest 5 USDT top-up
      address: testWalletAddress,
    });
    const deepLink = `${
      process.env.FRONTEND_ORIGIN || "http://localhost:5173"
    }/deeplink?${deepLinkParams.toString()}`;

    // In a real scenario, this would:
    // 1. Check watchlist for low balances
    // 2. Send Telegram notification with deep link
    // 3. User clicks deep link → lands on pre-filled swap interface

    const alertMessage = `
🚨 *Test Alert: Low Gas Balance*

Wallet: \`${testWalletAddress}\`
Chain: *${testChain.toUpperCase()}*
Current Balance: ${currentBalance} ETH
Threshold: ${threshold} ETH

⚡️ *Quick Top-Up*: [Tap here to top up](${deepLink})
    `.trim();

    logger.info(
      {
        testWalletAddress,
        testChain,
        deepLink,
        message: alertMessage,
      },
      "Test alert generated"
    );

    res.json({
      success: true,
      message:
        "Test alert generated! In production, this would be sent via Telegram.",
      alert: {
        wallet: testWalletAddress,
        chain: testChain,
        currentBalance,
        threshold,
        deepLink,
        message: alertMessage,
      },
    });
  } catch (error: any) {
    logger.error({ error }, "Test alert error");
    res.status(500).json({
      success: false,
      error: "Failed to generate test alert",
    });
  }
});

export default router;
