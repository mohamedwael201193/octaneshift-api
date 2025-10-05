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
      
      // Set up webhook route for production
      if (process.env.TELEGRAM_WEBHOOK_SECRET) {
        app.post(
          `/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`,
          express.json(),
          telegramBotService.getWebhookHandler()
        );
        logger.info('Telegram webhook route configured');
      }
      
      logger.info('✅ Telegram bot initialized successfully');
    } else {
      logger.warn('⚠️ Telegram bot is disabled');
    }
  } catch (error) {
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

// Start the server
const server = app.listen(PORT, async () => {
  logger.info({
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    frontendOrigin: FRONTEND_ORIGIN,
    telegramBot: !!telegramBotService
  }, 'OctaneShift API server started');

  // Initialize Telegram bot after server starts
  await initializeBot();

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

// Export for testing
export default app;