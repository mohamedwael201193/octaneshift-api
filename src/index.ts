import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createTelegramBot, TelegramBotService } from './bot/telegram';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { extractClientIP } from './middleware/ip';
import { rateLimitConfig } from './middleware/rateLimit';
import sideshiftRoutes from './routes/sideshift';
import telegramRoutes from './routes/telegram';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// Initialize Telegram bot
let telegramBotService: TelegramBotService | null = null;

async function initializeBot() {
  try {
    telegramBotService = createTelegramBot();
    
    if (telegramBotService) {
      await telegramBotService.initialize();
      
      // Direct webhook route registration with enhanced logging
      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (webhookSecret) {
        const webhookPath = `/webhook/telegram/${webhookSecret}`;
        
        console.log('🔧 Registering webhook route:', webhookPath);
        logger.info({ webhookPath, secret: webhookSecret }, 'Registering webhook route');
        
        // Register POST route for webhook with direct handling
        app.post(webhookPath, express.json({ limit: '1mb' }), (req, res): void => {
          const startTime = Date.now();
          console.log('📡 Webhook request received:', req.method, req.path);
          
          try {
            // Validate request body
            if (!req.body || typeof req.body !== 'object') {
              console.log('❌ Invalid webhook body');
              res.status(400).json({ error: 'Invalid request body' });
              return;
            }

            const update = req.body;
            
            // Validate update structure
            if (!update.update_id || typeof update.update_id !== 'number') {
              console.log('❌ Invalid update structure:', update);
              res.status(400).json({ error: 'Invalid update structure' });
              return;
            }

            console.log('✅ Processing webhook update:', update.update_id);
            logger.info({ 
              updateId: update.update_id,
              hasMessage: 'message' in update,
              hasCallbackQuery: 'callback_query' in update
            }, 'Processing Telegram webhook update');

            // Process the update with the bot
            telegramBotService!.handleUpdate(update);
            
            const processingTime = Date.now() - startTime;
            console.log(`✅ Webhook processed successfully in ${processingTime}ms`);
            
            res.status(200).json({ 
              ok: true, 
              processed_at: new Date().toISOString(),
              processing_time: processingTime
            });
            
          } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error('❌ Webhook processing error:', error);
            logger.error({ error, processingTime }, 'Webhook processing error');
            
            res.status(500).json({ 
              error: 'Internal server error',
              timestamp: new Date().toISOString()
            });
          }
        });
        
        // Register GET route for testing
        app.get(webhookPath, (_req, res) => {
          res.json({
            message: 'Telegram webhook endpoint',
            path: webhookPath,
            method: 'POST required for webhook',
            status: 'active',
            timestamp: new Date().toISOString()
          });
        });
        
        console.log('✅ Webhook routes registered successfully at:', webhookPath);
        logger.info({ webhookPath }, 'Webhook routes registered successfully');
      } else {
        console.log('❌ Webhook route not registered - missing TELEGRAM_WEBHOOK_SECRET');
        logger.warn('Webhook route not registered - missing TELEGRAM_WEBHOOK_SECRET');
      }
      
      logger.info('✅ Telegram bot initialized successfully');
    } else {
      logger.warn('⚠️ Telegram bot is disabled');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error);
    logger.error({ error }, '❌ Failed to initialize Telegram bot');
  }
}

// Trust proxy (required for Render and other proxy environments)
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration - strict frontend origin
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow configured frontend origin
    if (origin === FRONTEND_ORIGIN) {
      return callback(null, true);
    }
    
    // Allow localhost in development
    if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Request logging with Pino
app.use(pinoHttp({
  logger,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[Redacted]'
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  }
}));

// Parse JSON bodies (limit to 1MB)
app.use(express.json({ 
  limit: '1mb',
  type: 'application/json'
}));

// Parse URL-encoded bodies
app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb' 
}));

// Extract client IP middleware
app.use(extractClientIP);

// Root route - API information
app.get('/', rateLimitConfig.health, (req, res) => {
  const webhookUrl = process.env.APP_BASE_URL && process.env.TELEGRAM_WEBHOOK_SECRET 
    ? `${process.env.APP_BASE_URL}/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`
    : null;

  const apiInfo = {
    name: 'OctaneShift API',
    description: 'Cross-chain gas top-up service powered by SideShift.ai',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      health: '/health',
      api: '/api',
      telegram_debug: '/api/telegram'
    },
    telegram: {
      bot_enabled: !!telegramBotService,
      mode: telegramBotService ? 'active' : 'disabled',
      webhook_url: webhookUrl,
      webhook_configured: !!process.env.TELEGRAM_WEBHOOK_SECRET
    },
    links: {
      health_check: `${req.protocol}://${req.get('host')}/health`,
      api_docs: `${req.protocol}://${req.get('host')}/api`,
      telegram_status: `${req.protocol}://${req.get('host')}/api/telegram/status`
    }
  };

  logger.debug(apiInfo, 'Root API info requested');
  res.json(apiInfo);
});

// Health check endpoint
app.get('/health', rateLimitConfig.health, (_req, res) => {
  const healthData = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    commit: process.env.RENDER_GIT_COMMIT?.substring(0, 7) || undefined
  };

  logger.debug(healthData, 'Health check requested');
  res.json(healthData);
});

// Bot status route - check bot health and configuration
app.get('/api/bot/status', rateLimitConfig.general, async (_req, res): Promise<void> => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      res.status(400).json({
        error: 'Telegram bot not configured',
        bot_enabled: false,
        webhook_configured: false
      });
      return;
    }

    // Test Telegram API connectivity
    let botInfo = null;
    let webhookInfo = null;
    let apiConnectivity = false;
    
    try {
      const { request } = await import('undici');
      
      // Get bot info
      const botResponse = await request(`https://api.telegram.org/bot${botToken}/getMe`);
      const botData = await botResponse.body.json() as any;
      
      if (botData.ok) {
        botInfo = botData.result;
        apiConnectivity = true;
      }
      
      // Get webhook info
      const webhookResponse = await request(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const webhookData = await webhookResponse.body.json() as any;
      
      if (webhookData.ok) {
        webhookInfo = webhookData.result;
      }
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Telegram API');
    }

    const webhookUrl = process.env.APP_BASE_URL && process.env.TELEGRAM_WEBHOOK_SECRET 
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
        pending_update_count: webhookInfo?.pending_update_count || 0
      },
      environment: {
        node_env: process.env.NODE_ENV,
        base_url: process.env.APP_BASE_URL,
        admin_chat_id: !!process.env.TELEGRAM_ADMIN_CHAT_ID
      },
      health: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    };

    logger.info(status, 'Bot status requested');
    res.json(status);
  } catch (error) {
    logger.error({ error }, 'Error getting bot status');
    res.status(500).json({
      error: 'Failed to get bot status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bot test route - comprehensive testing
app.get('/api/bot/test', rateLimitConfig.general, async (_req, res): Promise<void> => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    
    if (!botToken) {
      res.status(400).json({
        error: 'TELEGRAM_BOT_TOKEN not configured',
        tests: {
          bot_token: false,
          admin_chat: false,
          api_connectivity: false,
          webhook_delivery: false
        }
      });
      return;
    }

    const tests = {
      bot_token: !!botToken,
      admin_chat: !!adminChatId,
      api_connectivity: false,
      webhook_delivery: false,
      message_sent: false
    };

    let testResults = {
      success: false,
      tests,
      details: {} as any
    };

    try {
      const { request } = await import('undici');
      
      // Test 1: API Connectivity
      const botResponse = await request(`https://api.telegram.org/bot${botToken}/getMe`);
      const botData = await botResponse.body.json() as any;
      
      if (botData.ok) {
        tests.api_connectivity = true;
        testResults.details.bot_info = botData.result;
      }

      // Test 2: Webhook Status
      const webhookResponse = await request(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const webhookData = await webhookResponse.body.json() as any;
      
      if (webhookData.ok) {
        tests.webhook_delivery = true;
        testResults.details.webhook_info = webhookData.result;
      }

      // Test 3: Send test message (if admin chat is configured)
      if (adminChatId && tests.api_connectivity) {
        const testMessage = `🧪 *Bot Test* - ${new Date().toISOString()}\n\n` +
          `✅ Bot is responding correctly\n` +
          `🔗 API connectivity: Working\n` +
          `📡 Webhook: ${tests.webhook_delivery ? 'Configured' : 'Not configured'}\n` +
          `🖥️ Server: ${process.env.APP_BASE_URL || 'localhost'}\n\n` +
          `This test message verifies the bot is functioning properly.`;
        
        const messageResponse = await request(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: testMessage,
            parse_mode: 'Markdown'
          })
        });

        const messageData = await messageResponse.body.json() as any;
        
        if (messageData.ok) {
          tests.message_sent = true;
          testResults.details.test_message = messageData.result;
        } else {
          testResults.details.message_error = messageData.description;
        }
      }

      testResults.success = tests.bot_token && tests.api_connectivity;
      
    } catch (error) {
      testResults.details.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error }, 'Bot test failed');
    }

    const responseStatus = testResults.success ? 200 : 500;
    logger.info({ testResults }, 'Bot test completed');
    
    res.status(responseStatus).json({
      message: testResults.success ? 'Bot tests completed successfully' : 'Some bot tests failed',
      timestamp: new Date().toISOString(),
      ...testResults
    });
    
  } catch (error) {
    logger.error({ error }, 'Error running bot tests');
    res.status(500).json({
      error: 'Failed to run bot tests',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.use('/api', sideshiftRoutes);
app.use('/api/telegram', telegramRoutes);

// Handle 404 for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (telegramBotService) {
    await telegramBotService.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (telegramBotService) {
    await telegramBotService.stop();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

// Initialize Telegram bot before starting the server
async function startServer() {
  // Initialize bot first
  await initializeBot();

  // Start the server
  const server = app.listen(PORT, async () => {
    logger.info({
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      frontendOrigin: FRONTEND_ORIGIN,
      telegramBot: !!telegramBotService
    }, 'OctaneShift API server started');

    // Log registered routes for debugging
    if (process.env.NODE_ENV === 'production') {
      const webhookPath = process.env.TELEGRAM_WEBHOOK_SECRET 
        ? `/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}` 
        : 'not configured';
      
      console.log('📋 Registered routes summary:');
      console.log('  • Root:', '/');
      console.log('  • Health:', '/health');
      console.log('  • API:', '/api');
      console.log('  • Telegram routes:', '/api/telegram');
      console.log('  • Webhook POST:', webhookPath);
      console.log('  • Webhook GET:', webhookPath, '(test endpoint)');
      
      logger.info({
        registeredRoutes: {
          root: '/',
          health: '/health',
          api: '/api',
          telegramRoutes: '/api/telegram',
          webhook: webhookPath
        }
      }, 'Registered routes');
    }

    // Setup webhook for production only
    if (telegramBotService && process.env.NODE_ENV === 'production' && process.env.APP_BASE_URL?.startsWith('https://')) {
      try {
        const webhookUrl = `${process.env.APP_BASE_URL}/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`;
        
        const success = await telegramBotService.setWebhook(webhookUrl);
        if (success) {
          logger.info({ webhookUrl }, 'Telegram webhook configured successfully');
        } else {
          logger.warn('Failed to configure Telegram webhook automatically');
        }
      } catch (error) {
        logger.error({ error }, 'Error setting up Telegram webhook');
      }
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

// Start the application
startServer().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});

// Export for testing
export default app;