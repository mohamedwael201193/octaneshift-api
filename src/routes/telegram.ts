import { Request, Response, Router } from 'express';
import { request } from 'undici';
import { rateLimitConfig } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get webhook information from Telegram API
 */
router.get('/status', rateLimitConfig.general, async (_req: Request, res: Response): Promise<void> => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(400).json({
        error: 'TELEGRAM_BOT_TOKEN not configured'
      });
      return;
    }

    // Get webhook info from Telegram
    const response = await request(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhookInfo = await response.body.json() as any;

    // Get bot info
    const botResponse = await request(`https://api.telegram.org/bot${botToken}/getMe`);
    const botInfo = await botResponse.body.json() as any;

    const status = {
      bot: {
        info: botInfo.result || null,
        token_configured: !!botToken,
        token_prefix: botToken ? botToken.substring(0, 10) + '...' : null
      },
      webhook: {
        info: webhookInfo.result || null,
        configured_url: process.env.APP_BASE_URL && process.env.TELEGRAM_WEBHOOK_SECRET 
          ? `${process.env.APP_BASE_URL}/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`
          : null,
        secret_configured: !!process.env.TELEGRAM_WEBHOOK_SECRET,
        environment: process.env.NODE_ENV || 'development'
      },
      server: {
        base_url: process.env.APP_BASE_URL || 'not configured',
        port: process.env.PORT || 3000,
        uptime: process.uptime()
      }
    };

    logger.info(status, 'Telegram status requested');
    res.json(status);
  } catch (error) {
    logger.error({ error }, 'Error getting Telegram status');
    res.status(500).json({
      error: 'Failed to get Telegram status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get current webhook configuration
 */
router.get('/webhook-info', rateLimitConfig.general, async (_req: Request, res: Response): Promise<void> => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(400).json({
        error: 'TELEGRAM_BOT_TOKEN not configured'
      });
      return;
    }

    const response = await request(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const data = await response.body.json() as any;

    if (data.ok) {
      logger.debug(data.result, 'Webhook info retrieved');
      res.json({
        ok: true,
        webhook: data.result,
        configured: {
          url: process.env.APP_BASE_URL && process.env.TELEGRAM_WEBHOOK_SECRET 
            ? `${process.env.APP_BASE_URL}/webhook/telegram/${process.env.TELEGRAM_WEBHOOK_SECRET}`
            : null,
          secret: !!process.env.TELEGRAM_WEBHOOK_SECRET,
          base_url: process.env.APP_BASE_URL || null
        }
      });
    } else {
      res.status(400).json({
        ok: false,
        error: data.description || 'Failed to get webhook info'
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error getting webhook info');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test webhook delivery
 */
router.post('/test-webhook', rateLimitConfig.general, async (_req: Request, res: Response): Promise<void> => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken) {
      res.status(400).json({
        error: 'TELEGRAM_BOT_TOKEN not configured'
      });
      return;
    }

    if (!adminChatId) {
      res.status(400).json({
        error: 'TELEGRAM_ADMIN_CHAT_ID not configured'
      });
      return;
    }

    // Send a test message to admin
    const testMessage = `🧪 Webhook Test - ${new Date().toISOString()}\\n\\nThis is a test message to verify the webhook is working correctly.`;
    
    const response = await request(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: testMessage,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.body.json() as any;

    if (data.ok) {
      logger.info({ messageId: data.result.message_id }, 'Test webhook message sent');
      res.json({
        ok: true,
        message: 'Test message sent successfully',
        telegram_response: data.result
      });
    } else {
      logger.error({ telegramError: data }, 'Failed to send test message');
      res.status(400).json({
        ok: false,
        error: 'Failed to send test message',
        telegram_error: data.description
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error testing webhook');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Set webhook URL
 */
router.post('/set-webhook', rateLimitConfig.general, async (req: Request, res: Response): Promise<void> => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const baseUrl = process.env.APP_BASE_URL;

    if (!botToken) {
      res.status(400).json({
        error: 'TELEGRAM_BOT_TOKEN not configured'
      });
      return;
    }

    if (!webhookSecret) {
      res.status(400).json({
        error: 'TELEGRAM_WEBHOOK_SECRET not configured'
      });
      return;
    }

    if (!baseUrl) {
      res.status(400).json({
        error: 'APP_BASE_URL not configured'
      });
      return;
    }

    const webhookUrl = `${baseUrl}/webhook/telegram/${webhookSecret}`;
    
    const response = await request(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        drop_pending_updates: req.body.drop_pending_updates || false
      })
    });

    const data = await response.body.json() as any;

    if (data.ok) {
      logger.info({ webhookUrl }, 'Webhook set successfully');
      res.json({
        ok: true,
        message: 'Webhook set successfully',
        webhook_url: webhookUrl,
        telegram_response: data.result
      });
    } else {
      logger.error({ telegramError: data, webhookUrl }, 'Failed to set webhook');
      res.status(400).json({
        ok: false,
        error: 'Failed to set webhook',
        telegram_error: data.description,
        webhook_url: webhookUrl
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error setting webhook');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete webhook (switch to polling mode)
 */
router.delete('/webhook', rateLimitConfig.general, async (req: Request, res: Response): Promise<void> => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      res.status(400).json({
        error: 'TELEGRAM_BOT_TOKEN not configured'
      });
      return;
    }

    const response = await request(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drop_pending_updates: req.body.drop_pending_updates || false
      })
    });

    const data = await response.body.json() as any;

    if (data.ok) {
      logger.info('Webhook deleted successfully');
      res.json({
        ok: true,
        message: 'Webhook deleted successfully, bot switched to polling mode',
        telegram_response: data.result
      });
    } else {
      logger.error({ telegramError: data }, 'Failed to delete webhook');
      res.status(400).json({
        ok: false,
        error: 'Failed to delete webhook',
        telegram_error: data.description
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error deleting webhook');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Debug webhook route registration
 */
router.get('/debug-routes', rateLimitConfig.general, async (_req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const baseUrl = process.env.APP_BASE_URL;
    
    const debug = {
      environment: process.env.NODE_ENV,
      webhook: {
        secret_configured: !!webhookSecret,
        secret_length: webhookSecret?.length || 0,
        base_url: baseUrl || 'not configured',
        full_webhook_url: baseUrl && webhookSecret ? `${baseUrl}/webhook/telegram/${webhookSecret}` : null,
        expected_path: webhookSecret ? `/webhook/telegram/${webhookSecret}` : null
      },
      telegram: {
        bot_token_configured: !!process.env.TELEGRAM_BOT_TOKEN,
        admin_chat_configured: !!process.env.TELEGRAM_ADMIN_CHAT_ID
      },
      server: {
        port: process.env.PORT || 3000,
        uptime: process.uptime()
      }
    };

    logger.info(debug, 'Debug routes info requested');
    res.json(debug);
  } catch (error) {
    logger.error({ error }, 'Error getting debug routes info');
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;