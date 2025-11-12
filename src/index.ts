import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { createTelegramBot, TelegramBotService } from "./bot/telegram";
import * as coinsCache from "./lib/coinsCache";
import { authenticateToken } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { extractClientIP } from "./middleware/ip";
import { rateLimitConfig } from "./middleware/rateLimit";
import { addSecurityHeaders, sanitizeInput } from "./middleware/security";
import adminRoutes from "./routes/admin";
import batchRoutes from "./routes/batch";
import checkoutRoutes from "./routes/checkout";
import deeplinkRoutes from "./routes/deeplink";
import giftsRoutes from "./routes/gifts";
import metaRoutes from "./routes/meta";
import notificationsRoutes from "./routes/notifications";
import presetsRoutes from "./routes/presets";
import proofRoutes from "./routes/proof";
import shiftsRoutes from "./routes/shifts";
import sideshiftRoutes from "./routes/sideshift";
import statsRoutes from "./routes/stats";
import statusRoutes from "./routes/status";
import telegramRoutes from "./routes/telegram";
import testAlertRoutes from "./routes/test-alert";
import topupRoutes from "./routes/topup";
import watchlistsRoutes from "./routes/watchlists";
import webhooksRoutes from "./routes/webhooks";
import * as backgroundJobs from "./services/backgroundJobs";
import * as monitor from "./services/monitor";
import * as notificationService from "./services/notifications";
import * as store from "./store/store";
import { logger } from "./utils/logger";

const app = express();
const PORT = process.env.PORT || 3000;

// Parse FRONTEND_ORIGIN as comma-separated list to support multiple origins
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGIN || "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Initialize Telegram bot
let telegramBotService: TelegramBotService | null = null;

async function initializeStore() {
  try {
    await store.load();
    store.startPeriodicSave();
    logger.info("✅ Store initialized successfully");
  } catch (error) {
    logger.error({ error }, "❌ Failed to initialize store");
  }
}

async function initializeBot() {
  try {
    telegramBotService = createTelegramBot();

    if (telegramBotService) {
      await telegramBotService.initialize();
      // Configure notification service with bot reference
      notificationService.setBotService(telegramBotService);
      logger.info("✅ Telegram bot initialized successfully");
    } else {
      logger.warn("⚠️ Telegram bot is disabled");
      notificationService.setBotService(null);
    }
  } catch (error) {
    console.error("❌ Failed to initialize Telegram bot:", error);
    logger.error({ error }, "❌ Failed to initialize Telegram bot");
    notificationService.setBotService(null);
  }
}

// Trust proxy (required for Render and other proxy environments)
app.set("trust proxy", true);

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// CORS configuration - supports multiple frontend origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow configured frontend origins
      if (FRONTEND_ORIGINS.includes(origin)) {
        logger.debug(
          { origin, allowedOrigins: FRONTEND_ORIGINS },
          "CORS: Origin allowed"
        );
        return callback(null, true);
      }

      // Allow localhost in development
      if (
        process.env.NODE_ENV === "development" &&
        origin.startsWith("http://localhost:")
      ) {
        logger.debug({ origin }, "CORS: Localhost allowed in development");
        return callback(null, true);
      }

      logger.warn(
        { origin, allowedOrigins: FRONTEND_ORIGINS },
        "CORS: Origin blocked"
      );
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Request logging with Pino
app.use(
  pinoHttp({
    logger,
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie"],
      censor: "[Redacted]",
    },
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return "warn";
      } else if (res.statusCode >= 500 || err) {
        return "error";
      }
      return "info";
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} - ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
    },
  })
);

// Parse JSON bodies (limit to 1MB)
app.use(
  express.json({
    limit: "1mb",
    type: "application/json",
  })
);

// Parse URL-encoded bodies
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// Extract client IP middleware
app.use(extractClientIP);

// Security headers
app.use(addSecurityHeaders);

// Input sanitization
app.use(sanitizeInput);

// Root route - API information
app.get("/", rateLimitConfig.health, (req, res) => {
  const webhookUrl =
    process.env.APP_BASE_URL && process.env.TELEGRAM_WEBHOOK_SECRET
      ? `${process.env.APP_BASE_URL}/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`
      : null;

  const apiInfo = {
    name: "OctaneShift API",
    description: "Cross-chain gas top-up service powered by SideShift.ai",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      health: "/health",
      api: "/api",
      telegram_debug: "/api/telegram",
    },
    telegram: {
      bot_enabled: !!telegramBotService,
      mode: telegramBotService ? "active" : "disabled",
      webhook_url: webhookUrl,
      webhook_configured: !!process.env.TELEGRAM_WEBHOOK_SECRET,
    },
    links: {
      health_check: `${req.protocol}://${req.get("host")}/health`,
      api_docs: `${req.protocol}://${req.get("host")}/api`,
      telegram_status: `${req.protocol}://${req.get(
        "host"
      )}/api/telegram/status`,
    },
  };

  logger.debug(apiInfo, "Root API info requested");
  res.json(apiInfo);
});

// Health check endpoint (legacy)
app.get("/health", rateLimitConfig.health, (_req, res) => {
  const healthData = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    commit: process.env.RENDER_GIT_COMMIT?.substring(0, 7) || undefined,
  };

  logger.debug(healthData, "Health check requested");
  res.json(healthData);
});

// API health check endpoint (new standard)
app.get("/api/health", rateLimitConfig.health, (_req, res) => {
  const pkg = require("../package.json");
  const healthData = {
    ok: true,
    version: pkg.version || "1.0.0",
    uptimeSeconds: Math.floor(process.uptime()),
  };

  logger.debug(healthData, "API health check requested");
  res.json(healthData);
});

// Bot status route - check bot health and configuration
app.get(
  "/api/bot/status",
  rateLimitConfig.general,
  async (_req, res): Promise<void> => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!botToken) {
        res.status(400).json({
          error: "Telegram bot not configured",
          bot_enabled: false,
          webhook_configured: false,
        });
        return;
      }

      // Test Telegram API connectivity
      let botInfo = null;
      let webhookInfo = null;
      let apiConnectivity = false;

      try {
        const { request } = await import("undici");

        // Get bot info
        const botResponse = await request(
          `https://api.telegram.org/bot${botToken}/getMe`
        );
        const botData = (await botResponse.body.json()) as any;

        if (botData.ok) {
          botInfo = botData.result;
          apiConnectivity = true;
        }

        // Get webhook info
        const webhookResponse = await request(
          `https://api.telegram.org/bot${botToken}/getWebhookInfo`
        );
        const webhookData = (await webhookResponse.body.json()) as any;

        if (webhookData.ok) {
          webhookInfo = webhookData.result;
        }
      } catch (error) {
        logger.error({ error }, "Failed to connect to Telegram API");
      }

      const webhookUrl =
        process.env.APP_BASE_URL && process.env.TELEGRAM_WEBHOOK_SECRET
          ? `${process.env.APP_BASE_URL}/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`
          : null;

      const status = {
        bot_enabled: !!telegramBotService,
        bot_running: telegramBotService ? true : false,
        api_connectivity: apiConnectivity,
        bot_info: botInfo,
        webhook: {
          configured: !!process.env.TELEGRAM_WEBHOOK_SECRET,
          url: webhookUrl,
          active: webhookInfo?.url === webhookUrl,
          info: webhookInfo,
          pending_update_count: webhookInfo?.pending_update_count || 0,
        },
        environment: {
          node_env: process.env.NODE_ENV,
          base_url: process.env.APP_BASE_URL,
          admin_chat_id: !!process.env.TELEGRAM_ADMIN_CHAT_ID,
        },
        health: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
      };

      logger.info(status, "Bot status requested");
      res.json(status);
    } catch (error) {
      logger.error({ error }, "Error getting bot status");
      res.status(500).json({
        error: "Failed to get bot status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Bot test route - comprehensive testing
app.get(
  "/api/bot/test",
  rateLimitConfig.general,
  async (_req, res): Promise<void> => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

      if (!botToken) {
        res.status(400).json({
          error: "TELEGRAM_BOT_TOKEN not configured",
          tests: {
            bot_token: false,
            admin_chat: false,
            api_connectivity: false,
            webhook_delivery: false,
          },
        });
        return;
      }

      const tests = {
        bot_token: !!botToken,
        admin_chat: !!adminChatId,
        api_connectivity: false,
        webhook_delivery: false,
        message_sent: false,
      };

      let testResults = {
        success: false,
        tests,
        details: {} as any,
      };

      try {
        const { request } = await import("undici");

        // Test 1: API Connectivity
        const botResponse = await request(
          `https://api.telegram.org/bot${botToken}/getMe`
        );
        const botData = (await botResponse.body.json()) as any;

        if (botData.ok) {
          tests.api_connectivity = true;
          testResults.details.bot_info = botData.result;
        }

        // Test 2: Webhook Status
        const webhookResponse = await request(
          `https://api.telegram.org/bot${botToken}/getWebhookInfo`
        );
        const webhookData = (await webhookResponse.body.json()) as any;

        if (webhookData.ok) {
          tests.webhook_delivery = true;
          testResults.details.webhook_info = webhookData.result;
        }

        // Test 3: Send test message (if admin chat is configured)
        if (adminChatId && tests.api_connectivity) {
          const testMessage =
            `🧪 *Bot Test* - ${new Date().toISOString()}\n\n` +
            `✅ Bot is responding correctly\n` +
            `🔗 API connectivity: Working\n` +
            `📡 Webhook: ${
              tests.webhook_delivery ? "Configured" : "Not configured"
            }\n` +
            `🖥️ Server: ${process.env.APP_BASE_URL || "localhost"}\n\n` +
            `This test message verifies the bot is functioning properly.`;

          const messageResponse = await request(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: adminChatId,
                text: testMessage,
                parse_mode: "Markdown",
              }),
            }
          );

          const messageData = (await messageResponse.body.json()) as any;

          if (messageData.ok) {
            tests.message_sent = true;
            testResults.details.test_message = messageData.result;
          } else {
            testResults.details.message_error = messageData.description;
          }
        }

        testResults.success = tests.bot_token && tests.api_connectivity;
      } catch (error) {
        testResults.details.error =
          error instanceof Error ? error.message : "Unknown error";
        logger.error({ error }, "Bot test failed");
      }

      const responseStatus = testResults.success ? 200 : 500;
      logger.info({ testResults }, "Bot test completed");

      res.status(responseStatus).json({
        message: testResults.success
          ? "Bot tests completed successfully"
          : "Some bot tests failed",
        timestamp: new Date().toISOString(),
        ...testResults,
      });
    } catch (error) {
      logger.error({ error }, "Error running bot tests");
      res.status(500).json({
        error: "Failed to run bot tests",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Store test endpoints (development only)
if (process.env.NODE_ENV === "development") {
  // Test: Create a user
  app.post("/api/test/store/user", express.json(), (req, res) => {
    const user = store.createUser(req.body);
    res.json({ success: true, user });
  });

  // Test: Get all users
  app.get("/api/test/store/users", (_req, res) => {
    const users = store.getAllUsers();
    res.json({ success: true, users });
  });

  // Test: Create a watchlist
  app.post("/api/test/store/watchlist", express.json(), (req, res) => {
    const watchlist = store.createWatchlist(req.body);
    res.json({ success: true, watchlist });
  });

  // Test: Get all watchlists
  app.get("/api/test/store/watchlists", (_req, res) => {
    const watchlists = store.getAllWatchlists();
    res.json({ success: true, watchlists });
  });

  // Test: Manual save
  app.post("/api/test/store/save", async (_req, res) => {
    await store.save();
    res.json({ success: true, message: "Store saved" });
  });

  // Test: Get native balance
  app.get("/api/test/balance/:chain/:address", async (req, res) => {
    try {
      const { chain, address } = req.params;
      const chains = await import("./lib/chains");

      const balance = await chains.getNativeBalance(chain as any, address);
      const config = chains.getChainConfig(chain as any);
      const formatted = chains.formatBalance(
        balance,
        config.nativeCurrency.decimals
      );

      res.json({
        success: true,
        chain,
        address,
        balance: balance.toString(),
        formatted: `${formatted} ${config.nativeCurrency.symbol}`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || "Unknown error",
      });
    }
  });
}

// API routes
app.use("/api/meta", metaRoutes);
app.use("/api", sideshiftRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/deeplink", deeplinkRoutes);
app.use("/api/gifts", giftsRoutes);
app.use("/api/proof", proofRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/test-alert", testAlertRoutes);
app.use("/api/topup", topupRoutes);
app.use("/api/topup", batchRoutes); // Mount batch routes under /api/topup/batch
app.use("/api/presets", presetsRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/webhooks", webhooksRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", watchlistsRoutes);

// Debug endpoint for SideShift order creation
app.post("/api/test/create-shift", express.json(), async (req, res) => {
  try {
    const {
      depositCoin,
      settleCoin,
      settleAddress,
      depositNetwork,
      settleNetwork,
      amount,
    } = req.body;

    console.log("🧪 Testing shift creation with params:", {
      depositCoin,
      settleCoin,
      settleAddress,
      depositNetwork,
      settleNetwork,
      amount,
    });

    // Import the SideShift service
    const sideshift = await import("./lib/sideshift");

    // Test the pair first
    const pairParams = {
      from: `${depositCoin}-${depositNetwork}`,
      to: `${settleCoin}-${settleNetwork}`,
      amount: amount,
    };

    console.log("🧪 Getting pair info with params:", pairParams);
    const pair = await sideshift.default.getPair(pairParams);
    console.log("✅ Pair info received:", pair);

    // Test shift creation
    const shiftParams = {
      depositCoin,
      depositNetwork,
      settleCoin,
      settleNetwork,
      settleAddress,
    };

    console.log("🧪 Creating shift with params:", shiftParams);
    const shift = await sideshift.default.createVariableShift(shiftParams);
    console.log("✅ Shift created:", shift);

    res.json({
      success: true,
      pair,
      shift,
    });
  } catch (error: any) {
    console.error("❌ Detailed SideShift error:", {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });

    res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
      details: error.response?.data,
      status: error.response?.status,
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
  }
});

// SideShift API health check endpoint
app.get("/api/test/sideshift-health", async (_req, res) => {
  try {
    console.log("🧪 Testing SideShift API health...");
    const sideshift = await import("./lib/sideshift");

    // Test basic API connectivity with permissions endpoint
    const permissions = await sideshift.default.getPermissions();
    console.log("✅ SideShift API is responding:", permissions);

    // Test a simple pair request
    const testPair = await sideshift.default.getPair({
      from: "usdt-ethereum",
      to: "eth-base",
    });
    console.log("✅ SideShift pair request working:", testPair);

    res.json({
      success: true,
      api_status: "healthy",
      permissions,
      sample_pair: testPair,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ SideShift API health check failed:", error);

    res.status(500).json({
      success: false,
      api_status: "unhealthy",
      error: error.message || "Unknown error",
      details: error.response?.data,
      timestamp: new Date().toISOString(),
    });
  }
});

// Test exact user scenario endpoint - both GET and POST for convenience
const userScenarioHandler = async (_req: any, res: any) => {
  try {
    console.log("🧪 Testing exact user scenario...");
    const sideshift = await import("./lib/sideshift");

    // Test the exact parameters from the user's conversation
    const userParams = {
      depositCoin: "usdt",
      depositNetwork: "ethereum",
      settleCoin: "eth",
      settleNetwork: "base",
      settleAddress: "0xe1641A049381149AFAacef386ee58fDA5ad9Be32",
    };

    console.log("🧪 Testing with user parameters:", userParams);

    // First test the pair
    const pairParams = {
      from: `${userParams.depositCoin}-${userParams.depositNetwork}`,
      to: `${userParams.settleCoin}-${userParams.settleNetwork}`,
    };

    console.log("🧪 Getting pair info...");
    const pair = await sideshift.default.getPair(pairParams);
    console.log("✅ Pair info received:", pair);

    // Now test shift creation
    console.log("🧪 Creating shift...");
    const shift = await sideshift.default.createVariableShift(userParams);
    console.log("✅ Shift created:", shift);

    res.json({
      success: true,
      pair,
      shift,
      message: "User scenario test successful",
    });
    res.json({
      success: true,
      pair,
      shift,
      message: "User scenario test successful",
    });
  } catch (error: any) {
    console.error("❌ User scenario test failed:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      stack: error.stack,
    });

    // Better error extraction for debugging
    let debugError = "Unknown error";
    if (error.response?.data) {
      if (typeof error.response.data === "string") {
        debugError = error.response.data;
      } else if (error.response.data.message) {
        debugError = error.response.data.message;
      } else if (error.response.data.error) {
        debugError = error.response.data.error;
      } else {
        debugError = JSON.stringify(error.response.data);
      }
    } else if (error.message) {
      debugError = error.message;
    }

    res.status(500).json({
      success: false,
      error: debugError,
      raw_error: error.message || "Unknown error",
      details: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
  }
};

// Register both GET and POST routes for user scenario testing
app.get("/api/test/user-scenario", userScenarioHandler);
app.post("/api/test/user-scenario", express.json(), userScenarioHandler);

// Quick API test endpoint
app.get("/api/test/quick-sideshift", async (_req, res) => {
  try {
    console.log("🧪 Quick SideShift API test...");
    const sideshift = await import("./lib/sideshift");

    // Test just a simple pair request
    const testPair = await sideshift.default.getPair({
      from: "usdt-ethereum",
      to: "eth-base",
    });

    res.json({
      success: true,
      message: "SideShift API is working",
      pair: testPair,
    });
  } catch (error: any) {
    console.error("❌ Quick SideShift test failed:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
      details: error.response?.data,
      status: error.response?.status,
    });
  }
});

// Test error handling endpoint
app.get("/api/test/error-handling", async (_req, res) => {
  try {
    console.log("🧪 Testing error handling...");
    const sideshift = await import("./lib/sideshift");

    // Intentionally cause an error with invalid parameters
    const badShift = await sideshift.default.createVariableShift({
      depositCoin: "invalid",
      depositNetwork: "invalid",
      settleCoin: "invalid",
      settleNetwork: "invalid",
      settleAddress: "invalid-address",
    });

    res.json({
      success: true,
      shift: badShift,
    });
  } catch (error: any) {
    console.error("❌ Expected error for testing:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Test our error extraction logic
    let extractedError = "Unknown error";
    if (error.response?.data) {
      if (typeof error.response.data === "string") {
        extractedError = error.response.data;
      } else if (error.response.data.message) {
        extractedError = error.response.data.message;
      } else if (error.response.data.error) {
        extractedError = error.response.data.error;
      } else {
        extractedError = JSON.stringify(error.response.data);
      }
    } else if (error.message) {
      extractedError = error.message;
    }

    res.json({
      success: false,
      message: "This error is expected - testing error handling",
      extracted_error: extractedError,
      raw_error: error.message,
      response_data: error.response?.data,
      status: error.response?.status,
    });
  }
});

// DIRECT WEBHOOK REGISTRATION - MUST WORK
if (process.env.TELEGRAM_WEBHOOK_SECRET) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookPath = `/webhook/telegram/${webhookSecret}`;

  console.log("🔧 DIRECT route registration:", webhookPath);

  // POST webhook handler
  app.post(webhookPath, express.json(), (req, res): void => {
    console.log("📡 WEBHOOK CALLED:", req.method, req.path, "from:", req.ip);

    try {
      // Validate secret from header (Telegram sends this)
      const telegramSecret = req.headers["x-telegram-bot-api-secret-token"];
      if (telegramSecret !== webhookSecret) {
        console.log(
          "❌ Invalid secret:",
          telegramSecret,
          "expected:",
          webhookSecret
        );
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const update = req.body;
      console.log("✅ Processing update:", update.update_id);

      // Process with bot (only if bot is available)
      if (telegramBotService) {
        telegramBotService.handleUpdate(update);
        console.log("✅ Webhook processed successfully");
        res.status(200).json({ ok: true });
      } else {
        console.log("❌ Bot service not available");
        res.status(503).json({ error: "Bot service not available" });
      }
    } catch (error) {
      console.error("❌ Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET test handler
  app.get(webhookPath, (req, res) => {
    console.log("📡 GET webhook test from:", req.ip);
    res.status(200).json({
      message: "Webhook endpoint active",
      method: "POST required for Telegram",
      status: "working",
      timestamp: new Date().toISOString(),
    });
  });

  console.log("✅ DIRECT routes registered at:", webhookPath);

  // Add fallback webhook route for debugging
  app.all("/webhook/telegram/*", (req, res) => {
    console.log(
      "🚨 FALLBACK webhook route called:",
      req.method,
      req.path,
      "from:",
      req.ip
    );
    console.log("🚨 Expected path was:", webhookPath);
    res.status(404).json({
      error: "Webhook path not found",
      received_path: req.path,
      expected_path: webhookPath,
      message: "Check webhook URL configuration",
    });
  });

  // Test route exists
  setTimeout(() => {
    console.log("🧪 Testing route registration...");
    console.log("🧪 Webhook route should be accessible at:", webhookPath);
    // This will help verify if route is actually registered
  }, 1000);
}

// Monitor control endpoints
app.get("/api/monitor/status", authenticateToken, (_req, res) => {
  try {
    const status = monitor.getMonitorStatus();
    res.json(status);
  } catch (error) {
    logger.error({ error }, "Failed to get monitor status");
    res.status(500).json({ error: "Failed to get monitor status" });
  }
});

app.post("/api/monitor/start", authenticateToken, (_req, res) => {
  try {
    monitor.startMonitor();
    res.json({
      message: "Monitor started",
      status: monitor.getMonitorStatus(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to start monitor");
    res.status(500).json({ error: "Failed to start monitor" });
  }
});

app.post("/api/monitor/stop", authenticateToken, (_req, res) => {
  try {
    monitor.stopMonitor();
    res.json({
      message: "Monitor stopped",
      status: monitor.getMonitorStatus(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to stop monitor");
    res.status(500).json({ error: "Failed to stop monitor" });
  }
});

app.post("/api/monitor/trigger", authenticateToken, async (_req, res) => {
  try {
    await monitor.triggerMonitorCycle();
    res.json({
      message: "Monitor cycle triggered",
      status: monitor.getMonitorStatus(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to trigger monitor cycle");
    res.status(500).json({ error: "Failed to trigger monitor cycle" });
  }
});

// Handle 404 for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  if (telegramBotService) {
    await telegramBotService.stop();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  if (telegramBotService) {
    await telegramBotService.stop();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  logger.fatal({ error }, "Uncaught exception");
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason, promise) => {
  logger.fatal({ reason, promise }, "Unhandled promise rejection");
  process.exit(1);
});

// Initialize Telegram bot before starting the server
async function startServer() {
  console.log("🚀 Starting server initialization...");
  console.log("📝 Routes will be registered in this order:");
  console.log("  1. Security middleware");
  console.log("  2. API routes (/api, /api/telegram)");
  console.log("  3. DIRECT webhook routes");
  console.log("  4. Error handlers");

  // Initialize store first
  await initializeStore();

  // Initialize coins cache
  console.log("💰 Initializing coins cache...");
  try {
    await coinsCache.initializeCoinsCache();
    console.log("✅ Coins cache initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize coins cache:", error);
    logger.error({ error }, "Failed to initialize coins cache");
  }

  // Initialize bot
  await initializeBot();

  // Start monitoring service
  console.log("🔍 Starting monitoring service...");
  monitor.startMonitor();
  console.log("✅ Monitoring service started");

  // Start background jobs
  console.log("🔧 Starting background jobs...");
  backgroundJobs.startBackgroundJobs();
  console.log("✅ Background jobs started");

  // Start the server
  const server = app.listen(PORT, async () => {
    logger.info(
      {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        frontendOrigins: FRONTEND_ORIGINS,
        telegramBot: !!telegramBotService,
      },
      "OctaneShift API server started"
    );

    console.log("🎯 Server is now listening on port", PORT);
    console.log("🔍 Route registration verification:");

    // Log registered routes for debugging
    if (process.env.NODE_ENV === "production") {
      const webhookPath = process.env.TELEGRAM_WEBHOOK_SECRET
        ? `/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`
        : "not configured";

      console.log("📋 Registered routes summary:");
      console.log("  • Root:", "/");
      console.log("  • Health:", "/health");
      console.log("  • API:", "/api");
      console.log("  • Telegram routes:", "/api/telegram");
      console.log("  • Webhook POST:", webhookPath);
      console.log("  • Webhook GET:", webhookPath, "(test endpoint)");

      logger.info(
        {
          registeredRoutes: {
            root: "/",
            health: "/health",
            api: "/api",
            telegramRoutes: "/api/telegram",
            webhook: webhookPath,
          },
        },
        "Registered routes"
      );
    }

    // Setup webhook for production only
    if (
      telegramBotService &&
      process.env.NODE_ENV === "production" &&
      process.env.APP_BASE_URL?.startsWith("https://")
    ) {
      try {
        const webhookUrl = `${process.env.APP_BASE_URL}/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`;

        const success = await telegramBotService.setWebhook(webhookUrl);
        if (success) {
          logger.info(
            { webhookUrl },
            "Telegram webhook configured successfully"
          );
        } else {
          logger.warn("Failed to configure Telegram webhook automatically");
        }
      } catch (error) {
        logger.error({ error }, "Error setting up Telegram webhook");
      }
    }
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");

    // Stop monitor
    monitor.stopMonitor();

    // Stop background jobs
    backgroundJobs.stopBackgroundJobs();

    // Save store before shutting down
    store.stopPeriodicSave();
    await store.save();

    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully");

    // Stop monitor
    monitor.stopMonitor();

    // Save store before shutting down
    store.stopPeriodicSave();
    await store.save();

    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
}

// Start the application
startServer().catch((error) => {
  logger.fatal({ error }, "Failed to start server");
  process.exit(1);
});

// Export for testing
export default app;
