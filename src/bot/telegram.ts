import { Request, Response } from "express";
import { Context, Telegraf } from "telegraf";
import { Update } from "telegraf/typings/core/types/typegram";
import { request } from "undici";
import sideshift, { SideShiftError, type Pair } from "../lib/sideshift";
import { getExampleAddress, validateAddress } from "../utils/addressValidation";
import { logger } from "../utils/logger";
import {
  createBotConfig,
  getBotMode,
  isConfigValid,
  logBotConfig,
} from "./config";
import { getNetworkByAlias, getSupportedChains } from "./networkMap";
import * as uiHelpers from "./uiHelpers";

// Utility function to extract meaningful error messages
function extractErrorMessage(error: any): string {
  // Handle SideShift API errors with response data
  if (error.response?.data) {
    if (typeof error.response.data === "string") {
      return error.response.data;
    }

    if (error.response.data.message) {
      return error.response.data.message;
    }

    if (error.response.data.error) {
      return error.response.data.error;
    }

    // If it's an object, try to extract useful info
    try {
      const errorStr = JSON.stringify(error.response.data);
      if (errorStr !== "{}") {
        return `API Error: ${errorStr}`;
      }
    } catch (e) {
      // Fall through to next check
    }
  }

  // Handle standard Error objects
  if (
    error.message &&
    error.message !== "[object Object]" &&
    error.message !== "Error"
  ) {
    return error.message;
  }

  // Handle SideShiftError specifically
  if (error instanceof SideShiftError && error.message) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === "string" && error !== "[object Object]") {
    return error;
  }

  // Last resort
  return "An unknown error occurred. Please try again or contact support.";
}

interface BotContext extends Context {
  match?: RegExpExecArray | null;
}

// User session management for multi-step flows
interface UserSession {
  step: "awaiting_deposit_asset" | "awaiting_address" | "awaiting_confirmation";
  targetNetwork?: string;
  targetAmount?: number;
  depositAsset?: string;
  settleAsset?: string;
  quote?: Pair;
  calculatedDepositAmount?: string;
  calculatedSettleAmount?: string;
  settleAddress?: string;
  timestamp: number;
}

const userSessions = new Map<number, UserSession>();

// Common deposit assets for gas top-ups with minimum amounts
const COMMON_DEPOSIT_ASSETS = [
  {
    coin: "usdc",
    network: "ethereum",
    display: "USDC (Ethereum)",
    minAmount: 5.1,
  },
  { coin: "usdc", network: "base", display: "USDC (Base)", minAmount: 5.1 },
  {
    coin: "usdt",
    network: "ethereum",
    display: "USDT (Ethereum)",
    minAmount: 5.1,
  },
  {
    coin: "usdt",
    network: "polygon",
    display: "USDT (Polygon)",
    minAmount: 5.1,
  },
  {
    coin: "eth",
    network: "ethereum",
    display: "ETH (Ethereum)",
    minAmount: 0.002,
  },
  { coin: "btc", network: "bitcoin", display: "Bitcoin", minAmount: 0.0002 },
];

export class TelegramBotService {
  private bot: Telegraf;
  private token: string;
  private apiBaseUrl: string;
  private config: ReturnType<typeof createBotConfig>;
  private isRunning: boolean = false;

  constructor(token: string, apiBaseUrl: string) {
    this.token = token;
    this.apiBaseUrl = apiBaseUrl;
    this.config = createBotConfig();
    this.bot = new Telegraf(token);

    if (!isConfigValid()) {
      throw new Error("Invalid bot configuration");
    }

    this.setupCommands();
    logBotConfig();
  }

  public async initialize(): Promise<void> {
    try {
      if (this.config.usePolling) {
        logger.info("🤖 Starting bot in polling mode for development");
        // Don't await launch() - it blocks because polling runs continuously
        this.bot
          .launch()
          .then(() => {
            this.isRunning = true;
            logger.info("✅ Bot polling started successfully");
          })
          .catch((error) => {
            logger.error({ error }, "Failed to start bot polling");
          });
        // Mark as running immediately so server can continue
        this.isRunning = true;
        logger.info("✅ Bot launch initiated (non-blocking)");
      } else {
        logger.info("🌐 Bot configured for webhook mode (production)");
      }
    } catch (error) {
      logger.error({ error }, "Failed to initialize bot");
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.isRunning) {
      logger.info("Stopping Telegram bot");
      await this.bot.stop();
      this.isRunning = false;
    }
  }

  /**
   * Send a notification message to a user by their Telegram chat ID
   */
  public async sendNotification(
    chatId: number,
    message: string,
    options?: { parse_mode?: "Markdown" | "HTML" }
  ): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, message, options);
      logger.info({ chatId }, "Notification sent to user");
    } catch (error) {
      logger.error({ error, chatId }, "Failed to send notification to user");
      throw error;
    }
  }

  public handleUpdate(update: Update): void {
    try {
      this.bot.handleUpdate(update);
    } catch (error) {
      logger.error(
        { error, updateId: update.update_id },
        "Error handling update"
      );
      throw error;
    }
  }

  private setupCommands(): void {
    // Start command with enhanced onboarding
    this.bot.start((ctx) => {
      const isDev = this.config.isDevelopment;
      const modeInfo = isDev ? `\n\n*Mode:* ${getBotMode()}` : "";
      const userName = ctx.from?.first_name || "there";

      const keyboard = {
        inline_keyboard: [
          [
            { text: "⛽ Quick Top-up", callback_data: "quick_topup" },
            { text: "📊 My Shifts", callback_data: "my_shifts" },
          ],
          [
            { text: "� Notifications", callback_data: "notifications" },
            { text: "💱 Create Shift", callback_data: "create_shift" },
          ],
          [
            { text: "�💡 How it Works", callback_data: "how_it_works" },
            { text: "🔗 Supported Chains", callback_data: "supported_chains" },
          ],
          ...(isDev
            ? [[{ text: "🧪 Test Bot", callback_data: "test_bot" }]]
            : []),
        ],
      };

      return ctx.reply(
        `� *Welcome${userName ? ` ${userName}` : ""}!*\n\n` +
          `🚀 *OctaneShift* helps you get native gas tokens across multiple blockchain networks instantly.\n\n` +
          `*Quick Start:*\n` +
          `• Tap *Quick Top-up* below to start\n` +
          `• Or create a custom shift with any coins\n\n` +
          `*Main Features:*\n` +
          `⛽ Quick gas top-ups (ETH, Base, Arbitrum, etc.)\n` +
          `💱 Swap any supported crypto instantly\n` +
          `🔔 Real-time notifications for your shifts\n` +
          `❌ Cancel shifts (after 5 minutes)\n\n` +
          `*Quick Commands:*\n` +
          `• \`/topup base 0.01\` - Top up gas\n` +
          `• \`/shifts\` - View your shifts\n` +
          `• \`/status <id>\` - Check shift status\n` +
          `• \`/cancel_order <id>\` - Cancel a shift\n` +
          `• \`/notifications\` - View notifications\n` +
          `${
            isDev
              ? "• `/test` - Bot diagnostics\n• `/ping` - Test response\n"
              : ""
          }` +
          `\n✨ *Powered by SideShift.ai* ⚡${modeInfo}`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    });

    // Development commands
    if (this.config.isDevelopment) {
      this.bot.command("test", async (ctx): Promise<void> => {
        const mode = getBotMode();

        await ctx.reply(
          `🧪 *Bot Test Results*\n\n` +
            `**Mode:** ${mode}\n` +
            `**Environment:** development\n` +
            `**Server:** ${this.apiBaseUrl}\n` +
            `**Status:** ✅ Working!\n\n` +
            `Bot is running correctly in ${mode} mode.`,
          { parse_mode: "Markdown" }
        );
      });

      this.bot.command("ping", async (ctx): Promise<void> => {
        const startTime = Date.now();
        const message = await ctx.reply("🏓 Pong!");
        const responseTime = Date.now() - startTime;

        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          message.message_id,
          undefined,
          `🏓 Pong! (${responseTime}ms)`
        );
      });
    }

    // Topup command
    this.bot.command("topup", async (ctx): Promise<void> => {
      const args = ctx.message.text.split(" ").slice(1);

      if (args.length !== 2) {
        await ctx.reply(
          "❌ *Invalid format*\n\n" +
            "**Usage:** `/topup <chain> <amount>`\n" +
            "**Example:** `/topup base 0.01`\n\n" +
            `**Supported chains:** ${getSupportedChains().join(", ")}`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const [chain, amountStr] = args;
      await this.handleTopup(ctx, chain, amountStr);
    });

    // Status command
    this.bot.command("status", async (ctx): Promise<void> => {
      const args = ctx.message.text.split(" ").slice(1);

      if (args.length !== 1) {
        await ctx.reply(
          "❌ *Invalid format*\n\n" +
            "**Usage:** `/status <shiftId>`\n" +
            "**Example:** `/status abc123def456`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const shiftId = args[0];
      await this.handleStatus(ctx, shiftId);
    });

    // Shifts command - list user's recent shifts
    this.bot.command("shifts", async (ctx): Promise<void> => {
      try {
        const userId = ctx.from?.id;
        if (!userId) {
          await ctx.reply("❌ Could not identify user.");
          return;
        }

        await ctx.reply("🔍 Fetching your recent shifts...");

        // Call API to get user's shifts (simplified - would need actual API integration)
        const keyboard = {
          inline_keyboard: [
            [
              { text: "🔄 Refresh", callback_data: "my_shifts" },
              { text: "⛽ New Top-up", callback_data: "quick_topup" },
            ],
          ],
        };

        await ctx.reply(
          "📊 *Your Recent Shifts*\n\n" +
            "To check the status of a specific shift, use:\n" +
            "`/status <shiftId>`\n\n" +
            "_Note: Shift history is coming soon!_",
          {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }
        );
      } catch (error) {
        logger.error({ error, userId: ctx.from?.id }, "Error fetching shifts");
        await ctx.reply(
          "❌ Error fetching your shifts. Please try again later."
        );
      }
    });

    // Cancel order command
    this.bot.command("cancel_order", async (ctx): Promise<void> => {
      const args = ctx.message.text.split(" ").slice(1);

      if (args.length !== 1) {
        await ctx.reply(
          "❌ *Invalid format*\n\n" +
            "**Usage:** `/cancel_order <shiftId>`\n" +
            "**Example:** `/cancel_order abc123def456`\n\n" +
            "⚠️ *Note:* You can only cancel an order **5+ minutes** after creation.\n" +
            "Orders cancelled earlier will return an error.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      const shiftId = args[0];
      await this.handleCancelOrder(ctx, shiftId);
    });

    // Notifications command
    this.bot.command("notifications", async (ctx): Promise<void> => {
      await this.handleNotifications(ctx);
    });

    // Handle callback queries
    this.bot.on("callback_query", async (ctx) => {
      const callbackQuery = ctx.callbackQuery;
      if (!("data" in callbackQuery)) {
        await ctx.answerCbQuery("Invalid callback");
        return;
      }

      const data = callbackQuery.data;

      try {
        if (data.startsWith("deposit:") || data.startsWith("deposit_")) {
          await this.handleDepositSelection(ctx, data);
        } else if (data.startsWith("page:deposit:")) {
          await this.handleDepositPagination(ctx, data);
        } else if (data.startsWith("browse:deposit:")) {
          await this.handleBrowseAllCoins(ctx, data);
        } else if (data.startsWith("search:deposit:")) {
          await this.handleCoinSearch(ctx, data);
        } else if (data === "cancel" || data === "cancel_topup") {
          await this.handleCancelTopup(ctx);
        } else if (data === "noop") {
          // No operation - just acknowledge
          await ctx.answerCbQuery();
        } else if (data.startsWith("status_")) {
          const shiftId = data.replace("status_", "");
          await this.handleStatus(ctx, shiftId);
        } else if (data.startsWith("chain_")) {
          const chain = data.replace("chain_", "");
          await ctx.answerCbQuery();
          await ctx.reply(
            `⛽ *Top up ${chain.toUpperCase()}*\n\n` +
              `How much do you want to top up?\n\n` +
              `**Common amounts:**\n` +
              `• \`/topup ${chain} 0.01\` - Small amount\n` +
              `• \`/topup ${chain} 0.05\` - Medium amount\n` +
              `• \`/topup ${chain} 0.1\` - Larger amount\n\n` +
              `Or use: \`/topup ${chain} <amount>\``,
            { parse_mode: "Markdown" }
          );
        } else if (data === "cancel_topup") {
          await this.handleCancelTopup(ctx);
        } else {
          // Handle existing static callbacks
          switch (data) {
            case "test_bot":
              if (this.config.isDevelopment) {
                await ctx.answerCbQuery();
                await ctx.reply(
                  "🧪 *Bot Test*\n\n" +
                    `**Status:** ✅ Running\n` +
                    `**Mode:** ${getBotMode()}\n` +
                    `**Server:** ${this.apiBaseUrl}\n\n` +
                    "Try the /test command for detailed diagnostics!",
                  { parse_mode: "Markdown" }
                );
              }
              return;

            case "quick_topup":
              await ctx.answerCbQuery();
              const chainsKeyboard = {
                inline_keyboard: [
                  [
                    { text: "🔵 Base", callback_data: "chain_base" },
                    { text: "🔷 Ethereum", callback_data: "chain_eth" },
                  ],
                  [
                    { text: "🔶 Arbitrum", callback_data: "chain_arb" },
                    { text: "🟣 Optimism", callback_data: "chain_op" },
                  ],
                  [
                    { text: "🟣 Polygon", callback_data: "chain_pol" },
                    { text: "🔴 Avalanche", callback_data: "chain_avax" },
                  ],
                  [{ text: "❌ Cancel", callback_data: "cancel_action" }],
                ],
              };
              await ctx.reply(
                "⛽ *Quick Top-up*\n\n" +
                  "Select the chain you want to top up:",
                {
                  parse_mode: "Markdown",
                  reply_markup: chainsKeyboard,
                }
              );
              return;

            case "my_shifts":
              await ctx.answerCbQuery();
              await ctx.reply(
                "📊 *Your Recent Shifts*\n\n" +
                  "Use `/shifts` command to view your shift history.\n\n" +
                  "To check a specific shift status:\n" +
                  "`/status <shiftId>`",
                { parse_mode: "Markdown" }
              );
              return;

            case "notifications":
              await ctx.answerCbQuery();
              await this.handleNotifications(ctx);
              return;

            case "create_shift":
              await ctx.answerCbQuery();
              await this.handleCreateShiftMenu(ctx);
              return;

            case "supported_chains":
              await ctx.answerCbQuery();
              await ctx.reply(
                "🔗 *Supported Chains*\n\n" +
                  "You can top up gas on these networks:\n\n" +
                  "🔵 **Base** - base, BASE\n" +
                  "🔷 **Ethereum** - eth, ethereum, ETH\n" +
                  "🔶 **Arbitrum** - arb, arbitrum, ARB\n" +
                  "🟣 **Optimism** - op, optimism, OP\n" +
                  "🟣 **Polygon** - pol, polygon\n" +
                  "🔴 **Avalanche** - avax, avalanche, AVAX\n\n" +
                  "*Usage:* `/topup <chain> <amount>`\n" +
                  "*Example:* `/topup base 0.01`",
                { parse_mode: "Markdown" }
              );
              return;

            case "cancel_action":
              await ctx.answerCbQuery("Cancelled");
              await ctx.reply(
                "❌ Action cancelled. Use /start to begin again."
              );
              return;

            case "topup_help":
              await ctx.answerCbQuery();
              await ctx.reply(
                "⛽ *Gas Top-up Help*\n\n" +
                  "**Format:** `/topup <chain> <amount>`\n\n" +
                  "**Examples:**\n" +
                  "• `/topup base 0.01` - Top up 0.01 ETH on Base\n" +
                  "• `/topup pol 5` - Top up 5 POL on Polygon\n" +
                  "• `/topup arb 0.005` - Top up 0.005 ETH on Arbitrum\n\n" +
                  `**Supported chains:** ${getSupportedChains().join(", ")}`,
                { parse_mode: "Markdown" }
              );
              return;

            case "status_help":
              await ctx.answerCbQuery();
              await ctx.reply(
                "📊 *Status Check Help*\n\n" +
                  "**Format:** `/status <shiftId>`\n\n" +
                  "**Example:**\n" +
                  "• `/status abc123def456`\n\n" +
                  "You get the shift ID when you create a top-up order.",
                { parse_mode: "Markdown" }
              );
              return;

            case "how_it_works":
              await ctx.answerCbQuery();
              await ctx.reply(
                "💡 *How OctaneShift Works*\n\n" +
                  "1️⃣ Choose your target chain and amount\n" +
                  "2️⃣ Select your deposit asset (USDC, USDT, etc.)\n" +
                  "3️⃣ Send crypto to the provided deposit address\n" +
                  "4️⃣ Receive native gas tokens instantly!\n" +
                  "5️⃣ Track progress with the shift ID\n\n" +
                  "✅ Powered by SideShift.ai\n" +
                  "✅ Non-custodial and secure\n" +
                  "✅ Fast cross-chain swaps\n" +
                  "✅ No registration required",
                { parse_mode: "Markdown" }
              );
              return;

            case "shift_fixed":
              await ctx.answerCbQuery();
              await ctx.reply(
                "🔀 *Fixed Shift*\n\n" +
                  "Select deposit coin for your fixed shift:",
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "💵 USDC",
                          callback_data: "deposit:usdc:mainnet:fixed",
                        },
                        {
                          text: "💵 USDT",
                          callback_data: "deposit:usdt:mainnet:fixed",
                        },
                      ],
                      [
                        {
                          text: "🔍 Search All Coins",
                          callback_data: "search:deposit:fixed",
                        },
                        {
                          text: "📄 Browse All",
                          callback_data: "browse:deposit:fixed",
                        },
                      ],
                      [{ text: "🔙 Back", callback_data: "create_shift" }],
                    ],
                  },
                }
              );
              return;

            case "shift_variable":
              await ctx.answerCbQuery();
              await ctx.reply(
                "🔄 *Variable Shift*\n\n" +
                  "Select deposit coin for your variable shift:",
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "💵 USDC",
                          callback_data: "deposit:usdc:mainnet:variable",
                        },
                        {
                          text: "💵 USDT",
                          callback_data: "deposit:usdt:mainnet:variable",
                        },
                      ],
                      [
                        {
                          text: "🔍 Search All Coins",
                          callback_data: "search:deposit:variable",
                        },
                        {
                          text: "📄 Browse All",
                          callback_data: "browse:deposit:variable",
                        },
                      ],
                      [{ text: "🔙 Back", callback_data: "create_shift" }],
                    ],
                  },
                }
              );
              return;

            case "shift_info":
              await ctx.answerCbQuery();
              await ctx.reply(
                "💡 *Fixed vs Variable Shifts*\n\n" +
                  "**🔀 Fixed Shift:**\n" +
                  "✓ Rate locked at creation\n" +
                  "✓ Know exact receive amount\n" +
                  "✓ Must deposit exact amount\n" +
                  "✓ Best for precise transactions\n\n" +
                  "**🔄 Variable Shift:**\n" +
                  "✓ Rate determined at deposit\n" +
                  "✓ Flexible deposit amount\n" +
                  "✓ Deposit within min/max range\n" +
                  "✓ Best for approximate amounts\n\n" +
                  "Both are processed instantly by SideShift!",
                { parse_mode: "Markdown" }
              );
              return;

            case "mark_all_read":
              await ctx.answerCbQuery("All notifications marked as read");
              await ctx.reply(
                "✅ All notifications have been marked as read!",
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
                    ],
                  },
                }
              );
              return;

            case "main_menu":
              await ctx.answerCbQuery();
              // Trigger the start command again
              const keyboard = {
                inline_keyboard: [
                  [
                    { text: "⛽ Quick Top-up", callback_data: "quick_topup" },
                    { text: "📊 My Shifts", callback_data: "my_shifts" },
                  ],
                  [
                    {
                      text: "🔔 Notifications",
                      callback_data: "notifications",
                    },
                    { text: "💱 Create Shift", callback_data: "create_shift" },
                  ],
                  [
                    { text: "💡 How it Works", callback_data: "how_it_works" },
                    {
                      text: "🔗 Supported Chains",
                      callback_data: "supported_chains",
                    },
                  ],
                ],
              };
              await ctx.reply("🏠 *Main Menu*\n\nChoose an option:", {
                parse_mode: "Markdown",
                reply_markup: keyboard,
              });
              return;

            default:
              await ctx.answerCbQuery("Unknown action");
              await ctx.reply(
                "❌ Unknown action. Please use /start to see available commands."
              );
              return;
          }
        }
      } catch (error) {
        logger.error({ error, data }, "Error handling callback query");
        await ctx.answerCbQuery("Error occurred");
        await ctx.reply("❌ An error occurred. Please try again.");
      }
    });

    // Handle unknown commands
    this.bot.on("message", async (ctx) => {
      const userId = ctx.from?.id;

      if ("text" in ctx.message) {
        const text = ctx.message.text;

        // Check if user has an active session waiting for address
        if (userId) {
          const session = userSessions.get(userId);
          if (session?.step === "awaiting_address") {
            await this.handleAddressInput(ctx, text);
            return;
          }
        }

        // Handle unknown commands
        if (text.startsWith("/")) {
          await ctx.reply(
            "❓ *Unknown command*\n\n" +
              "Use /start to see available commands.",
            { parse_mode: "Markdown" }
          );
        }
      }
    });
  }

  private async handleTopup(
    ctx: BotContext,
    chain: string,
    amountStr: string
  ): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Validate chain
      const network = getNetworkByAlias(chain);
      if (!network) {
        await ctx.reply(
          `❌ *Unsupported chain: ${chain}*\n\n` +
            `**Supported chains:** ${getSupportedChains().join(", ")}`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply(
          "❌ *Invalid amount*\n\n" +
            "Please provide a valid positive number.\n" +
            "**Example:** `/topup base 0.01`",
          { parse_mode: "Markdown" }
        );
        return;
      }

      await ctx.reply("🔍 *Checking available deposit options...*", {
        parse_mode: "Markdown",
      });

      // Show popular deposit asset selection with dynamic coins
      const keyboard = uiHelpers.buildPopularCoinsKeyboard(
        "deposit",
        `${chain}_${amount}`
      );

      // Store user session
      userSessions.set(userId, {
        step: "awaiting_deposit_asset",
        targetNetwork: chain,
        targetAmount: amount,
        timestamp: Date.now(),
      });

      await ctx.reply(
        `💰 *Gas Top-up: ${amount} ${network.nativeCurrency} on ${network.networkName}*\n\n` +
          `Choose what you'd like to deposit:`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      logger.error({ error, chain, amount: amountStr }, "Error handling topup");
      await ctx.reply(
        "❌ *Error processing request*\n\n" +
          "Please try again later or contact support.",
        { parse_mode: "Markdown" }
      );
    }
  }

  private async handleStatus(ctx: BotContext, shiftId: string): Promise<void> {
    try {
      await ctx.reply("🔍 *Checking order status...*", {
        parse_mode: "Markdown",
      });

      // Get shift status from SideShift API
      const shift = await sideshift.getShift(shiftId);

      const statusEmojis: Record<string, string> = {
        waiting: "⏳",
        pending: "🔄",
        processing: "⚙️",
        settled: "✅",
        refunding: "🔄",
        refunded: "💸",
      };

      const statusMessages: Record<string, string> = {
        waiting: "Waiting for deposit",
        pending: "Deposit received, processing...",
        processing: "Processing transaction",
        settled: "Completed successfully!",
        refunding: "Refunding deposit",
        refunded: "Deposit refunded",
      };

      const network = getNetworkByAlias(shift.settleNetwork);
      const explorerUrl = network?.explorerUrl;

      let message =
        `📊 *Order Status*\n\n` +
        `**Shift ID:** \`${shift.id}\`\n` +
        `**Status:** ${statusEmojis[shift.status]} ${
          statusMessages[shift.status]
        }\n` +
        `**From:** ${shift.depositCoin.toUpperCase()} (${
          shift.depositNetwork
        })\n` +
        `**To:** ${shift.settleCoin.toUpperCase()} (${shift.settleNetwork})\n` +
        `**Deposit Address:** \`${shift.depositAddress}\`\n`;

      if (shift.depositAmount) {
        message += `**Deposited:** ${
          shift.depositAmount
        } ${shift.depositCoin.toUpperCase()}\n`;
      }

      if (shift.settleAmount) {
        message += `**Received:** ${
          shift.settleAmount
        } ${shift.settleCoin.toUpperCase()}\n`;
      }

      if (shift.expiresAt) {
        const expiryDate = new Date(shift.expiresAt);
        const now = new Date();
        if (expiryDate > now) {
          const timeLeft = Math.ceil(
            (expiryDate.getTime() - now.getTime()) / (1000 * 60)
          );
          message += `**Expires:** ${timeLeft} minutes\n`;
        }
      }

      message += `\n**Created:** ${new Date(shift.createdAt).toLocaleString()}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 Refresh Status", callback_data: `status_${shiftId}` }],
        ] as any[],
      };

      // Add explorer link if settled and we have a network match
      if (shift.status === "settled" && explorerUrl) {
        // Note: We'd need the transaction hash from SideShift to create the actual link
        keyboard.inline_keyboard.push([
          { text: "🔗 View on Explorer", url: explorerUrl },
        ]);
      }

      await ctx.reply(message, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      if (error instanceof SideShiftError) {
        if (error.status === 404) {
          await ctx.reply(
            `📊 *Order Status*\n\n` +
              `**Shift ID:** \`${shiftId}\`\n` +
              `**Status:** ❓ Not found\n\n` +
              "This shift ID was not found. Please check the ID and try again.",
            { parse_mode: "Markdown" }
          );
          return;
        }

        await ctx.reply(
          `❌ *Error checking status*\n\n` +
            `${error.message}\n\n` +
            "Please try again later.",
          { parse_mode: "Markdown" }
        );
      } else {
        logger.error({ error, shiftId }, "Error checking status");
        await ctx.reply(
          "❌ *Error checking status*\n\n" +
            "Please try again later or contact support.",
          { parse_mode: "Markdown" }
        );
      }
    }
  }

  private async handleCancelOrder(
    ctx: BotContext,
    shiftId: string
  ): Promise<void> {
    try {
      await ctx.reply("🔄 *Processing cancellation...*", {
        parse_mode: "Markdown",
      });

      // Call the cancel endpoint
      await sideshift.cancelOrder(shiftId);

      await ctx.reply(
        `✅ *Order Cancelled Successfully*\n\n` +
          `**Shift ID:** \`${shiftId}\`\n\n` +
          `Your order has been cancelled. If you made a deposit, ` +
          `it will be refunded to your refund address.\n\n` +
          `Use \`/status ${shiftId}\` to check the refund status.`,
        { parse_mode: "Markdown" }
      );

      logger.info({ shiftId, userId: ctx.from?.id }, "Order cancelled via bot");
    } catch (error) {
      const errorMessage = extractErrorMessage(error);

      // Check for 5-minute rule violation
      if (
        errorMessage.includes("5 minutes") ||
        errorMessage.includes("too early") ||
        errorMessage.includes("wait")
      ) {
        await ctx.reply(
          `⏰ *Cannot Cancel Yet*\n\n` +
            `**Shift ID:** \`${shiftId}\`\n\n` +
            `⚠️ You can only cancel an order **5 minutes** after it was created.\n\n` +
            `This is a SideShift policy to prevent abuse. Please wait a few more minutes and try again.\n\n` +
            `**Tip:** Use \`/status ${shiftId}\` to check when you can cancel.`,
          { parse_mode: "Markdown" }
        );
      } else if (error instanceof SideShiftError && error.status === 404) {
        await ctx.reply(
          `❌ *Order Not Found*\n\n` +
            `**Shift ID:** \`${shiftId}\`\n\n` +
            `This shift ID was not found. Please check the ID and try again.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(
          `❌ *Cancellation Failed*\n\n` +
            `**Shift ID:** \`${shiftId}\`\n\n` +
            `**Error:** ${errorMessage}\n\n` +
            `Please try again or contact support if the issue persists.`,
          { parse_mode: "Markdown" }
        );
      }

      logger.error(
        { error, shiftId, userId: ctx.from?.id },
        "Failed to cancel order via bot"
      );
    }
  }

  /**
   * Handle notifications view
   */
  private async handleNotifications(ctx: BotContext): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Could not identify user.");
        return;
      }

      // Register user's telegram chat ID for future notifications
      const notificationService = await import("../services/notifications");
      notificationService.registerTelegramUser(userId.toString(), ctx.chat!.id);

      await ctx.reply("🔍 *Checking notifications...*", {
        parse_mode: "Markdown",
      });

      // Fetch notifications from API (would need actual implementation)
      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 Refresh", callback_data: "notifications" },
            { text: "✅ Mark All Read", callback_data: "mark_all_read" },
          ],
          [{ text: "🏠 Main Menu", callback_data: "main_menu" }],
        ],
      };

      await ctx.reply(
        "🔔 *Your Notifications*\n\n" +
          "You'll receive real-time notifications here when:\n\n" +
          "💸 Your shift is refunded\n" +
          "⏰ Your shift expires\n" +
          "✅ Your shift is completed\n" +
          "⚠️ There's an issue with your shift\n\n" +
          "_Notifications are enabled for this chat!_",
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );

      logger.info({ userId }, "User viewed notifications");
    } catch (error) {
      logger.error(
        { error, userId: ctx.from?.id },
        "Error handling notifications"
      );
      await ctx.reply("❌ Error loading notifications. Please try again.");
    }
  }

  /**
   * Handle create shift menu
   */
  private async handleCreateShiftMenu(ctx: BotContext): Promise<void> {
    try {
      const keyboard = {
        inline_keyboard: [
          [{ text: "⛽ Quick Gas Top-up", callback_data: "quick_topup" }],
          [
            { text: "🔀 Fixed Shift", callback_data: "shift_fixed" },
            { text: "🔄 Variable Shift", callback_data: "shift_variable" },
          ],
          [{ text: "💡 What's the difference?", callback_data: "shift_info" }],
          [{ text: "❌ Cancel", callback_data: "cancel_action" }],
        ],
      };

      await ctx.reply(
        "💱 *Create New Shift*\n\n" +
          "Choose your shift type:\n\n" +
          "⛽ **Quick Gas Top-up** - Fast gas refills for common chains\n\n" +
          "🔀 **Fixed Shift** - You know exactly how much you'll receive\n" +
          "   • Fixed rate guaranteed\n" +
          "   • Must deposit exact amount\n\n" +
          "🔄 **Variable Shift** - Flexible deposit amount\n" +
          "   • Rate determined at deposit time\n" +
          "   • Deposit any amount within range\n\n" +
          "Select an option below:",
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      logger.error({ error }, "Error showing create shift menu");
      await ctx.reply("❌ Error loading shift menu. Please try again.");
    }
  }

  private async handleDepositPagination(
    ctx: BotContext,
    data: string
  ): Promise<void> {
    try {
      await ctx.answerCbQuery();

      // Parse: page:deposit:{page}:{context}
      const parts = data.split(":");
      if (parts.length !== 4) {
        await ctx.reply("❌ Invalid pagination. Please try again.");
        return;
      }

      const page = parseInt(parts[2]);
      const context = parts[3]; // e.g., "base_0.01"

      // Get all coins and paginate
      const allCoins = uiHelpers.getAllCoinOptions();
      const pagination = uiHelpers.paginate(allCoins, page, 6);
      const keyboard = uiHelpers.buildPaginatedKeyboard(
        pagination,
        "deposit",
        context
      );

      await ctx.editMessageReplyMarkup(keyboard);
    } catch (error) {
      logger.error({ error, data }, "Error handling pagination");
      await ctx.answerCbQuery("Error loading page");
    }
  }

  private async handleBrowseAllCoins(
    ctx: BotContext,
    data: string
  ): Promise<void> {
    try {
      await ctx.answerCbQuery();

      // Parse: browse:deposit:{context}
      const parts = data.split(":");
      if (parts.length !== 3) {
        await ctx.reply("❌ Invalid browse request. Please try again.");
        return;
      }

      const context = parts[2]; // e.g., "base_0.01"

      // Get all coins and show first page
      const allCoins = uiHelpers.getAllCoinOptions();
      const pagination = uiHelpers.paginate(allCoins, 0, 6);
      const keyboard = uiHelpers.buildPaginatedKeyboard(
        pagination,
        "deposit",
        context
      );

      await ctx.editMessageText(
        `📋 *Browse All Coins* (${allCoins.length} total)\n\n` +
          `Choose a coin/network combination to deposit.\n` +
          `🏷️ indicates memo/tag required.`,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    } catch (error) {
      logger.error({ error, data }, "Error browsing coins");
      await ctx.answerCbQuery("Error loading coins");
    }
  }

  private async handleCoinSearch(ctx: BotContext, data: string): Promise<void> {
    try {
      await ctx.answerCbQuery();

      // Parse: search:deposit:{context}
      const parts = data.split(":");
      if (parts.length !== 3) {
        await ctx.reply("❌ Invalid search request. Please try again.");
        return;
      }

      const context = parts[2]; // e.g., "base_0.01"

      // Inform user about search
      await ctx.editMessageText(
        `🔍 *Search Coins*\n\n` +
          `Type the coin symbol or name you want to search for.\n\n` +
          `Examples: \`btc\`, \`ethereum\`, \`usdc\`, \`sol\`, \`doge\`\n\n` +
          `Or use /topup to start over.`,
        {
          parse_mode: "Markdown",
        }
      );

      // Set user session to awaiting search query
      const userId = ctx.from?.id;
      if (userId) {
        const session = userSessions.get(userId);
        if (session) {
          session.step = "awaiting_deposit_asset";
          // Store context in session for later
          (session as any).searchContext = context;
        }
      }
    } catch (error) {
      logger.error({ error, data }, "Error initiating search");
      await ctx.answerCbQuery("Error starting search");
    }
  }

  public getWebhookHandler() {
    return (req: Request, res: Response): void => {
      const startTime = Date.now();
      const userAgent = req.get("User-Agent") || "unknown";
      const contentType = req.get("Content-Type") || "unknown";
      const telegramSecret =
        req.get("X-Telegram-Bot-Api-Secret-Token") || "none";

      try {
        // Log incoming webhook request with more details
        logger.info(
          {
            userAgent,
            contentType,
            telegramSecret,
            bodySize: req.body ? JSON.stringify(req.body).length : 0,
            hasSecret: !!req.params.secret,
            path: req.path,
            url: req.url,
            method: req.method,
          },
          "Incoming Telegram webhook request"
        );

        // Validate webhook secret
        const secretParam = req.params.secret;
        const expectedSecret = this.config.webhookSecret;

        if (!expectedSecret) {
          logger.error("Webhook secret not configured on server");
          res.status(500).json({ error: "Server configuration error" });
          return;
        }

        if (!secretParam) {
          logger.warn(
            {
              path: req.path,
              params: req.params,
              query: req.query,
            },
            "Webhook request missing secret parameter"
          );
          res.status(400).json({ error: "Missing secret parameter" });
          return;
        }

        if (secretParam !== expectedSecret) {
          logger.warn(
            {
              providedSecret: secretParam.substring(0, 5) + "...",
              expectedPrefix: expectedSecret.substring(0, 5) + "...",
              path: req.path,
            },
            "Invalid webhook secret provided"
          );
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // Validate request body
        if (!req.body || typeof req.body !== "object") {
          logger.warn({ body: req.body }, "Invalid webhook body");
          res.status(400).json({ error: "Invalid request body" });
          return;
        }

        const update = req.body as Update;

        // Validate update structure
        if (!update.update_id || typeof update.update_id !== "number") {
          logger.warn({ update }, "Invalid update structure");
          res.status(400).json({ error: "Invalid update structure" });
          return;
        }

        // Log successful webhook processing start
        logger.info(
          {
            updateId: update.update_id,
            hasMessage: "message" in update,
            hasCallbackQuery: "callback_query" in update,
            messageType:
              "message" in update && update.message && "text" in update.message
                ? "text"
                : "other",
            userId:
              ("message" in update && update.message?.from?.id) ||
              ("callback_query" in update && update.callback_query?.from?.id) ||
              null,
          },
          "Processing Telegram webhook update"
        );

        // Process the update
        this.bot.handleUpdate(update);

        const processingTime = Date.now() - startTime;
        logger.info(
          {
            updateId: update.update_id,
            processingTime,
          },
          "Webhook processed successfully"
        );

        res
          .status(200)
          .json({ ok: true, processed_at: new Date().toISOString() });
      } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error(
          {
            error,
            userAgent,
            processingTime,
            body: req.body,
          },
          "Telegram webhook processing error"
        );

        res.status(500).json({
          error: "Internal server error",
          timestamp: new Date().toISOString(),
        });
      }
    };
  }

  private async handleDepositSelection(
    ctx: BotContext,
    data: string
  ): Promise<void> {
    let depositCoin = "";
    let depositNetwork = "";

    try {
      await ctx.answerCbQuery();

      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      // Parse callback data: deposit:{coin}:{network}:{targetChain}_{amount}
      // OR old format: deposit_{coin}_{network}_{targetChain}_{amount}
      let targetChain: string;
      let amountStr: string;

      if (data.includes(":")) {
        // New format with colon separator
        const parts = data.split(":");
        if (parts.length !== 4) {
          await ctx.reply("❌ Invalid selection. Please try again.");
          return;
        }
        [, depositCoin, depositNetwork] = parts;
        const contextParts = parts[3].split("_");
        [targetChain, amountStr] = contextParts;
      } else {
        // Old format with underscore separator (backward compatibility)
        const parts = data.split("_");
        if (parts.length !== 5) {
          await ctx.reply("❌ Invalid selection. Please try again.");
          return;
        }
        [, depositCoin, depositNetwork, targetChain, amountStr] = parts;
      }

      const amount = parseFloat(amountStr);

      // Get quote from SideShift
      await ctx.reply("🔄 *Getting quote...*", { parse_mode: "Markdown" });

      const targetNetwork = getNetworkByAlias(targetChain);
      if (!targetNetwork) {
        await ctx.reply("❌ Invalid target network.");
        return;
      }

      const fromCoin = `${depositCoin}-${depositNetwork}`;
      const toCoin = targetNetwork.settleCoin;

      // Get rate without amount first to avoid minimum errors
      const quote = await sideshift.getPair({
        from: fromCoin,
        to: toCoin,
      });

      // Calculate estimated amounts based on the quote rate and target amount
      const targetAmount = amount; // Amount of target currency (ETH) user wants
      const estimatedDepositAmount = quote.rate
        ? (targetAmount / parseFloat(quote.rate)).toFixed(6)
        : "TBD";
      const estimatedReceive = targetAmount.toFixed(6);

      // Check if the calculated deposit amount meets minimums
      const depositAmountFloat = parseFloat(estimatedDepositAmount);
      const asset = COMMON_DEPOSIT_ASSETS.find(
        (a) => a.coin === depositCoin && a.network === depositNetwork
      );

      if (asset && depositAmountFloat < asset.minAmount) {
        await ctx.reply(
          `⚠️ *Minimum Amount Required*\n\n` +
            `To receive ${targetAmount} ${
              targetNetwork.nativeCurrency
            }, you would need to deposit ~${estimatedDepositAmount} ${depositCoin.toUpperCase()}.\n\n` +
            `However, the minimum for ${depositCoin.toUpperCase()} is ${
              asset.minAmount
            }.\n\n` +
            `💡 *Suggestion:* Try requesting more ${
              targetNetwork.nativeCurrency
            } (at least ${(
              asset.minAmount * parseFloat(quote.rate || "1")
            ).toFixed(4)}) or choose a different deposit asset.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Update user session
      userSessions.set(userId, {
        step: "awaiting_address",
        targetNetwork: targetChain,
        targetAmount: targetAmount,
        depositAsset: fromCoin,
        settleAsset: toCoin,
        quote,
        calculatedDepositAmount: estimatedDepositAmount,
        calculatedSettleAmount: estimatedReceive,
        timestamp: Date.now(),
      });

      await ctx.reply(
        `💰 *Quote Received*\n\n` +
          `**You send:** ~${estimatedDepositAmount} ${depositCoin.toUpperCase()}\n` +
          `**You receive:** ~${estimatedReceive} ${targetNetwork.nativeCurrency}\n` +
          `**Rate:** ${
            quote.rate
              ? `1 ${depositCoin.toUpperCase()} = ${parseFloat(
                  quote.rate
                ).toFixed(6)} ${targetNetwork.nativeCurrency}`
              : "Variable"
          }\n` +
          `**Network:** ${targetNetwork.networkName}\n\n` +
          `Please send your **${targetNetwork.networkName}** address where you want to receive the gas tokens:`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      logger.error(
        { error, data, depositCoin, depositNetwork },
        "Error handling deposit selection"
      );

      // Use utility function to extract proper error message
      const errorMessage = extractErrorMessage(error);

      if (error instanceof SideShiftError) {
        let fullErrorMessage = `❌ *Error getting quote*\n\n${errorMessage}`;

        // Handle minimum amount errors specifically
        if (errorMessage.includes("below the minimum")) {
          const asset = COMMON_DEPOSIT_ASSETS.find(
            (a) => a.coin === depositCoin && a.network === depositNetwork
          );
          if (asset) {
            fullErrorMessage += `\n\n💡 *Tip:* Try with at least ${
              asset.minAmount
            } ${depositCoin.toUpperCase()} for this pair.`;
          }
        }

        await ctx.reply(fullErrorMessage, { parse_mode: "Markdown" });
      } else {
        await ctx.reply(
          `❌ *Error getting quote*\n\n${errorMessage}\n\n` +
            `Please try again or contact support if the issue persists.`,
          { parse_mode: "Markdown" }
        );
      }
    }
  }

  private async handleAddressInput(
    ctx: BotContext,
    address: string
  ): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply("❌ Unable to identify user.");
        return;
      }

      const session = userSessions.get(userId);
      if (!session || session.step !== "awaiting_address") {
        await ctx.reply(
          "❌ No active session. Please start with /topup command."
        );
        return;
      }

      // Validate address
      const network = getNetworkByAlias(session.targetNetwork!);
      if (!network) {
        await ctx.reply("❌ Invalid network configuration.");
        return;
      }

      const validationResult = validateAddress(
        address,
        network.chainId.toString()
      );
      if (!validationResult.isValid) {
        await ctx.reply(
          `❌ *Invalid ${network.networkName} address*\n\n` +
            `${validationResult.error || "Please provide a valid address."}\n` +
            `**Example:** ${getExampleAddress(network.chainId.toString())}`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Create the shift
      await ctx.reply("🔄 *Creating order...*", { parse_mode: "Markdown" });

      // Validate session data before making API call
      if (!session.quote) {
        throw new Error(
          "Quote not found in session. Please restart the process."
        );
      }

      if (!session.quote.depositCoin || !session.quote.settleCoin) {
        throw new Error("Invalid quote data: missing coin information.");
      }

      if (!session.quote.depositNetwork || !session.quote.settleNetwork) {
        throw new Error("Invalid quote data: missing network information.");
      }

      const shiftParams = {
        settleAddress: address,
        depositCoin: session.quote!.depositCoin,
        settleCoin: session.quote!.settleCoin,
        depositNetwork: session.quote!.depositNetwork,
        settleNetwork: session.quote!.settleNetwork,
        affiliateId: process.env.SIDESHIFT_AFFILIATE_ID,
      };

      // Debug logging for shift creation
      console.log("🔧 Creating SideShift with parameters:", {
        ...shiftParams,
        sessionQuote: session.quote,
        targetNetwork: session.targetNetwork,
        targetAmount: session.targetAmount,
      });

      logger.info(
        {
          shiftParams,
          sessionQuote: session.quote,
          userId,
          targetNetwork: session.targetNetwork,
        },
        "Creating SideShift order"
      );

      // Check SideShift API health before creating shift
      try {
        await sideshift.getPermissions();
      } catch (apiError) {
        console.error("❌ SideShift API health check failed:", apiError);
        throw new Error(
          "SideShift API is currently unavailable. Please try again later."
        );
      }

      console.log(
        "🚀 About to call createVariableShift with params:",
        shiftParams
      );
      const shift = await sideshift.createVariableShift(shiftParams);
      console.log("✅ Shift created successfully:", shift.id);

      // Clear session
      userSessions.delete(userId);

      // Generate QR code for deposit address
      let qrBuffer: Buffer | null = null;
      try {
        const { generateQRCode } = await import("../utils/qr");
        const qrString = await generateQRCode(shift.depositAddress);
        qrBuffer = Buffer.from(
          qrString.replace(/^data:image\/png;base64,/, ""),
          "base64"
        );
      } catch (error) {
        logger.warn({ error }, "Failed to generate QR code");
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: "📊 Check Status", callback_data: `status_${shift.id}` }],
        ] as any[],
      };

      let message =
        `✅ *Order Created Successfully!*\n\n` +
        `**Shift ID:** \`${shift.id}\`\n` +
        `**Deposit Address:**\n\`${shift.depositAddress}\`\n\n` +
        `**Send:** ${
          session.calculatedDepositAmount
        } ${session.quote!.depositCoin.toUpperCase()}\n` +
        `**Receive:** ~${
          session.calculatedSettleAmount
        } ${session.quote!.settleCoin.toUpperCase()} on ${
          network.networkName
        }\n` +
        `**To address:** \`${address}\`\n\n` +
        `⏰ **Order expires in:** ${Math.ceil(
          (new Date(shift.expiresAt).getTime() - Date.now()) / (1000 * 60)
        )} minutes\n\n` +
        `Use \`/status ${shift.id}\` to track your order.`;

      if (qrBuffer) {
        await ctx.replyWithPhoto(
          { source: qrBuffer },
          {
            caption: message,
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }
        );
      } else {
        await ctx.reply(message, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
    } catch (error: any) {
      const userId = ctx.from?.id;
      const currentSession = userId ? userSessions.get(userId) : null;

      console.error("❌ Shift creation error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
        userSession: currentSession,
        address: address,
      });

      logger.error(
        {
          error,
          userSession: currentSession,
          address,
          userId: ctx.from?.id,
        },
        "Error creating shift order"
      );

      // Use the centralized error extraction function
      const errorMessage = extractErrorMessage(error);

      await ctx.reply(
        `❌ *Error creating order*\n\n${errorMessage}\n\n` +
          `Please try again or contact support if the issue persists.`,
        { parse_mode: "Markdown" }
      );
    }
  }

  private async handleCancelTopup(ctx: BotContext): Promise<void> {
    try {
      await ctx.answerCbQuery();

      const userId = ctx.from?.id;
      if (!userId) return;

      // Clear user session
      userSessions.delete(userId);

      await ctx.reply(
        "❌ *Top-up cancelled*\n\n" +
          "You can start a new top-up anytime with the /topup command.",
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      logger.error({ error }, "Error handling cancel topup");
    }
  }

  public async setWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.token}/setWebhook`;
      const response = await request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: this.config.webhookSecret,
        }),
      });

      const result = (await response.body.json()) as any;

      if (result.ok) {
        logger.info({ webhookUrl }, "Telegram webhook set successfully");
        return true;
      } else {
        logger.error({ result }, "Failed to set Telegram webhook");
        return false;
      }
    } catch (error) {
      logger.error({ error, webhookUrl }, "Error setting Telegram webhook");
      return false;
    }
  }
}

export function createTelegramBot(): TelegramBotService | null {
  const config = createBotConfig();

  if (!config.botToken) {
    logger.warn("TELEGRAM_BOT_TOKEN not configured, Telegram bot disabled");
    return null;
  }

  try {
    const bot = new TelegramBotService(config.botToken, config.appBaseUrl);
    return bot;
  } catch (error) {
    logger.error({ error }, "Failed to create Telegram bot");
    return null;
  }
}

export default createTelegramBot;
