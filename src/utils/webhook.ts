import { request } from 'undici';
import { logger } from './logger';

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

export class TelegramWebhookManager {
  private baseURL: string;

  constructor(botToken: string) {
    this.baseURL = `https://api.telegram.org/bot${botToken}`;
    logger.debug({ botTokenLength: botToken.length }, 'TelegramWebhookManager initialized');
  }

  /**
   * Set the webhook URL for the bot
   */
  async setWebhook(webhookUrl: string, secretToken?: string): Promise<boolean> {
    try {
      const body: any = {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      };

      if (secretToken) {
        body.secret_token = secretToken;
      }

      const response = await request(`${this.baseURL}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.statusCode || response.statusCode >= 400) {
        const errorText = await response.body.text();
        logger.error({
          status: response.statusCode,
          error: errorText,
          webhookUrl
        }, 'Failed to set Telegram webhook');
        return false;
      }

      const result = await response.body.json() as any;
      
      if (result.ok) {
        logger.info({ webhookUrl }, 'Telegram webhook set successfully');
        return true;
      } else {
        logger.error({ error: result, webhookUrl }, 'Telegram API returned error for webhook setup');
        return false;
      }
    } catch (error) {
      logger.error({ error, webhookUrl }, 'Error setting Telegram webhook');
      return false;
    }
  }

  /**
   * Get current webhook info
   */
  async getWebhookInfo(): Promise<TelegramWebhookInfo | null> {
    try {
      const response = await request(`${this.baseURL}/getWebhookInfo`, {
        method: 'GET',
      });

      if (!response.statusCode || response.statusCode >= 400) {
        const errorText = await response.body.text();
        logger.error({
          status: response.statusCode,
          error: errorText
        }, 'Failed to get Telegram webhook info');
        return null;
      }

      const result = await response.body.json() as any;
      
      if (result.ok) {
        return result.result as TelegramWebhookInfo;
      } else {
        logger.error({ error: result }, 'Telegram API returned error for webhook info');
        return null;
      }
    } catch (error) {
      logger.error({ error }, 'Error getting Telegram webhook info');
      return null;
    }
  }

  /**
   * Delete the current webhook
   */
  async deleteWebhook(): Promise<boolean> {
    try {
      const response = await request(`${this.baseURL}/deleteWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.statusCode || response.statusCode >= 400) {
        const errorText = await response.body.text();
        logger.error({
          status: response.statusCode,
          error: errorText
        }, 'Failed to delete Telegram webhook');
        return false;
      }

      const result = await response.body.json() as any;
      
      if (result.ok) {
        logger.info('Telegram webhook deleted successfully');
        return true;
      } else {
        logger.error({ error: result }, 'Telegram API returned error for webhook deletion');
        return false;
      }
    } catch (error) {
      logger.error({ error }, 'Error deleting Telegram webhook');
      return false;
    }
  }

  /**
   * Setup webhook automatically based on environment
   */
  async setupWebhook(): Promise<boolean> {
    const appBaseUrl = process.env.APP_BASE_URL;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!appBaseUrl) {
      logger.warn('APP_BASE_URL not configured, skipping webhook setup');
      return false;
    }

    const webhookUrl = `${appBaseUrl}/webhook/telegram`;

    // Get current webhook info
    const currentInfo = await this.getWebhookInfo();
    
    if (currentInfo && currentInfo.url === webhookUrl) {
      logger.info({ webhookUrl }, 'Telegram webhook already configured correctly');
      return true;
    }

    // Set the new webhook
    const success = await this.setWebhook(webhookUrl, webhookSecret);
    
    if (success) {
      logger.info({ webhookUrl }, 'Telegram webhook configured automatically');
    }

    return success;
  }
}

export default TelegramWebhookManager;