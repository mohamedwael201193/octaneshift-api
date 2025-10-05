import { logger } from '../utils/logger';

export interface BotConfig {
  botToken: string;
  webhookSecret: string;
  appBaseUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
  usePolling: boolean;
  useWebhook: boolean;
}

export function createBotConfig(): BotConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  const usePolling = isDevelopment || appBaseUrl.startsWith('http://');
  const useWebhook = isProduction && appBaseUrl.startsWith('https://');

  return {
    botToken,
    webhookSecret,
    appBaseUrl,
    isDevelopment,
    isProduction,
    usePolling,
    useWebhook
  };
}

export function getBotMode(): string {
  const config = createBotConfig();
  return config.usePolling ? 'polling' : 'webhook';
}

export function isConfigValid(): boolean {
  const config = createBotConfig();
  return !!(config.botToken && config.webhookSecret);
}

export function logBotConfig(): void {
  const config = createBotConfig();
  logger.info({
    mode: getBotMode(),
    environment: config.isDevelopment ? 'development' : 'production',
    hasToken: !!config.botToken,
    baseUrl: config.appBaseUrl
  }, 'Bot configuration loaded');
}