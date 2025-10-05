import { Request, Response } from 'express';
import { Context, Telegraf } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { request } from 'undici';
import sideshift, { SideShiftError, type Pair } from '../lib/sideshift';
import { getExampleAddress, validateAddress } from '../utils/addressValidation';
import { logger } from '../utils/logger';
import { createBotConfig, getBotMode, isConfigValid, logBotConfig } from './config';
import { getNetworkByAlias, getSupportedChains } from './networkMap';

interface BotContext extends Context {
  match?: RegExpExecArray | null;
}

// User session management for multi-step flows
interface UserSession {
  step: 'awaiting_deposit_asset' | 'awaiting_address' | 'awaiting_confirmation';
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
  { coin: 'usdc', network: 'ethereum', display: 'USDC (Ethereum)', minAmount: 5.1 },
  { coin: 'usdc', network: 'base', display: 'USDC (Base)', minAmount: 5.1 },
  { coin: 'usdt', network: 'ethereum', display: 'USDT (Ethereum)', minAmount: 5.1 },
  { coin: 'usdt', network: 'polygon', display: 'USDT (Polygon)', minAmount: 5.1 },
  { coin: 'eth', network: 'ethereum', display: 'ETH (Ethereum)', minAmount: 0.002 },
  { coin: 'btc', network: 'bitcoin', display: 'Bitcoin', minAmount: 0.0002 }
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
      throw new Error('Invalid bot configuration');
    }
    
    this.setupCommands();
    logBotConfig();
  }

  public async initialize(): Promise<void> {
    try {
      if (this.config.usePolling) {
        logger.info('🤖 Starting bot in polling mode for development');
        await this.bot.launch();
        this.isRunning = true;
        logger.info('✅ Bot is now polling and ready to respond!');
      } else {
        logger.info('🌐 Bot configured for webhook mode (production)');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to initialize bot');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.isRunning) {
      logger.info('Stopping Telegram bot');
      await this.bot.stop();
      this.isRunning = false;
    }
  }

  public handleUpdate(update: Update): void {
    try {
      this.bot.handleUpdate(update);
    } catch (error) {
      logger.error({ error, updateId: update.update_id }, 'Error handling update');
      throw error;
    }
  }

  private setupCommands(): void {
    // Start command
    this.bot.start((ctx) => {
      const isDev = this.config.isDevelopment;
      const modeInfo = isDev ? `\n\n*Mode:* ${getBotMode()}` : '';
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '⛽ Top up Gas', callback_data: 'topup_help' }],
          [{ text: '📊 Check Status', callback_data: 'status_help' }],
          [{ text: '💡 How it Works', callback_data: 'how_it_works' }],
          ...(isDev ? [[{ text: '🧪 Test Bot', callback_data: 'test_bot' }]] : [])
        ]
      };

      return ctx.reply(
        `🚀 *Welcome to OctaneShift!*\n\n` +
        `Get native gas tokens across multiple chains instantly.\n\n` +
        `*Available Commands:*\n` +
        `• \`/topup <chain> <amount>\` - Top up gas\n` +
        `• \`/status <shiftId>\` - Check order status\n` +
        `${isDev ? '• `/test` - Bot diagnostics\n• `/ping` - Test response\n' : ''}` +
        `\n*Powered by SideShift.ai* ⚡${modeInfo}`,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );
    });

    // Development commands
    if (this.config.isDevelopment) {
      this.bot.command('test', async (ctx): Promise<void> => {
        const mode = getBotMode();
        
        await ctx.reply(
          `🧪 *Bot Test Results*\n\n` +
          `**Mode:** ${mode}\n` +
          `**Environment:** development\n` +
          `**Server:** ${this.apiBaseUrl}\n` +
          `**Status:** ✅ Working!\n\n` +
          `Bot is running correctly in ${mode} mode.`,
          { parse_mode: 'Markdown' }
        );
      });

      this.bot.command('ping', async (ctx): Promise<void> => {
        const startTime = Date.now();
        const message = await ctx.reply('🏓 Pong!');
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
    this.bot.command('topup', async (ctx): Promise<void> => {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length !== 2) {
        await ctx.reply(
          '❌ *Invalid format*\n\n' +
          '**Usage:** `/topup <chain> <amount>`\n' +
          '**Example:** `/topup base 0.01`\n\n' +
          `**Supported chains:** ${getSupportedChains().join(', ')}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const [chain, amountStr] = args;
      await this.handleTopup(ctx, chain, amountStr);
    });

    // Status command
    this.bot.command('status', async (ctx): Promise<void> => {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length !== 1) {
        await ctx.reply(
          '❌ *Invalid format*\n\n' +
          '**Usage:** `/status <shiftId>`\n' +
          '**Example:** `/status abc123def456`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const shiftId = args[0];
      await this.handleStatus(ctx, shiftId);
    });

    // Handle callback queries
    this.bot.on('callback_query', async (ctx) => {
      const callbackQuery = ctx.callbackQuery;
      if (!('data' in callbackQuery)) {
        await ctx.answerCbQuery('Invalid callback');
        return;
      }

      const data = callbackQuery.data;

      try {
        if (data.startsWith('deposit_')) {
          await this.handleDepositSelection(ctx, data);
        } else if (data.startsWith('status_')) {
          const shiftId = data.replace('status_', '');
          await this.handleStatus(ctx, shiftId);
        } else if (data === 'cancel_topup') {
          await this.handleCancelTopup(ctx);
        } else {
          // Handle existing static callbacks
          switch (data) {
            case 'test_bot':
              if (this.config.isDevelopment) {
                await ctx.answerCbQuery();
                await ctx.reply(
                  '🧪 *Bot Test*\n\n' +
                  `**Status:** ✅ Running\n` +
                  `**Mode:** ${getBotMode()}\n` +
                  `**Server:** ${this.apiBaseUrl}\n\n` +
                  'Try the /test command for detailed diagnostics!',
                  { parse_mode: 'Markdown' }
                );
              }
              return;

            case 'topup_help':
              await ctx.answerCbQuery();
              await ctx.reply(
                '⛽ *Gas Top-up Help*\n\n' +
                '**Format:** `/topup <chain> <amount>`\n\n' +
                '**Examples:**\n' +
                '• `/topup base 0.01` - Top up 0.01 ETH on Base\n' +
                '• `/topup matic 5` - Top up 5 MATIC on Polygon\n' +
                '• `/topup arb 0.005` - Top up 0.005 ETH on Arbitrum\n\n' +
                `**Supported chains:** ${getSupportedChains().join(', ')}`,
                { parse_mode: 'Markdown' }
              );
              return;

            case 'status_help':
              await ctx.answerCbQuery();
              await ctx.reply(
                '📊 *Status Check Help*\n\n' +
                '**Format:** `/status <shiftId>`\n\n' +
                '**Example:**\n' +
                '• `/status abc123def456`\n\n' +
                'You get the shift ID when you create a top-up order.',
                { parse_mode: 'Markdown' }
              );
              return;

            case 'how_it_works':
              await ctx.answerCbQuery();
              await ctx.reply(
                '💡 *How OctaneShift Works*\n\n' +
                '1️⃣ Choose your target chain and amount\n' +
                '2️⃣ Send crypto to the provided deposit address\n' +
                '3️⃣ Receive native gas tokens on your chosen network\n' +
                '4️⃣ Track progress with the shift ID\n\n' +
                '✅ Powered by SideShift.ai\n' +
                '✅ Non-custodial and secure\n' +
                '✅ Fast cross-chain swaps',
                { parse_mode: 'Markdown' }
              );
              return;

            default:
              await ctx.answerCbQuery('Unknown action');
              await ctx.reply('❌ Unknown action. Please use /start to see available commands.');
              return;
          }
        }
      } catch (error) {
        logger.error({ error, data }, 'Error handling callback query');
        await ctx.answerCbQuery('Error occurred');
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    });

    // Handle unknown commands
    this.bot.on('message', async (ctx) => {
      const userId = ctx.from?.id;
      
      if ('text' in ctx.message) {
        const text = ctx.message.text;
        
        // Check if user has an active session waiting for address
        if (userId) {
          const session = userSessions.get(userId);
          if (session?.step === 'awaiting_address') {
            await this.handleAddressInput(ctx, text);
            return;
          }
        }
        
        // Handle unknown commands
        if (text.startsWith('/')) {
          await ctx.reply(
            '❓ *Unknown command*\n\n' +
            'Use /start to see available commands.',
            { parse_mode: 'Markdown' }
          );
        }
      }
    });
  }

  private async handleTopup(ctx: BotContext, chain: string, amountStr: string): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Validate chain
      const network = getNetworkByAlias(chain);
      if (!network) {
        await ctx.reply(
          `❌ *Unsupported chain: ${chain}*\n\n` +
          `**Supported chains:** ${getSupportedChains().join(', ')}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Validate amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply(
          '❌ *Invalid amount*\n\n' +
          'Please provide a valid positive number.\n' +
          '**Example:** `/topup base 0.01`',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await ctx.reply(
        '🔍 *Checking available deposit options...*',
        { parse_mode: 'Markdown' }
      );

      // Show deposit asset selection
      const keyboard = {
        inline_keyboard: COMMON_DEPOSIT_ASSETS.map(asset => [
          { 
            text: asset.display, 
            callback_data: `deposit_${asset.coin}_${asset.network}_${chain}_${amount}` 
          }
        ]).concat([
          [{ text: '❌ Cancel', callback_data: 'cancel_topup' }]
        ])
      };

      // Store user session
      userSessions.set(userId, {
        step: 'awaiting_deposit_asset',
        targetNetwork: chain,
        targetAmount: amount,
        timestamp: Date.now()
      });

      await ctx.reply(
        `💰 *Gas Top-up: ${amount} ${network.nativeCurrency} on ${network.networkName}*\n\n` +
        `Choose what you'd like to deposit:`,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard
        }
      );

    } catch (error) {
      logger.error({ error, chain, amount: amountStr }, 'Error handling topup');
      await ctx.reply(
        '❌ *Error processing request*\n\n' +
        'Please try again later or contact support.',
        { parse_mode: 'Markdown' }
      );
    }
  }

  private async handleStatus(ctx: BotContext, shiftId: string): Promise<void> {
    try {
      await ctx.reply(
        '🔍 *Checking order status...*',
        { parse_mode: 'Markdown' }
      );

      // Get shift status from SideShift API
      const shift = await sideshift.getShift(shiftId);
      
      const statusEmojis: Record<string, string> = {
        waiting: '⏳',
        pending: '🔄', 
        processing: '⚙️',
        settled: '✅',
        refunding: '🔄',
        refunded: '💸'
      };

      const statusMessages: Record<string, string> = {
        waiting: 'Waiting for deposit',
        pending: 'Deposit received, processing...',
        processing: 'Processing transaction',
        settled: 'Completed successfully!',
        refunding: 'Refunding deposit',
        refunded: 'Deposit refunded'
      };

      const network = getNetworkByAlias(shift.settleNetwork);
      const explorerUrl = network?.explorerUrl;
      
      let message = 
        `📊 *Order Status*\n\n` +
        `**Shift ID:** \`${shift.id}\`\n` +
        `**Status:** ${statusEmojis[shift.status]} ${statusMessages[shift.status]}\n` +
        `**From:** ${shift.depositCoin.toUpperCase()} (${shift.depositNetwork})\n` +
        `**To:** ${shift.settleCoin.toUpperCase()} (${shift.settleNetwork})\n` +
        `**Deposit Address:** \`${shift.depositAddress}\`\n`;

      if (shift.depositAmount) {
        message += `**Deposited:** ${shift.depositAmount} ${shift.depositCoin.toUpperCase()}\n`;
      }

      if (shift.settleAmount) {
        message += `**Received:** ${shift.settleAmount} ${shift.settleCoin.toUpperCase()}\n`;
      }

      if (shift.expiresAt) {
        const expiryDate = new Date(shift.expiresAt);
        const now = new Date();
        if (expiryDate > now) {
          const timeLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60));
          message += `**Expires:** ${timeLeft} minutes\n`;
        }
      }

      message += `\n**Created:** ${new Date(shift.createdAt).toLocaleString()}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '🔄 Refresh Status', callback_data: `status_${shiftId}` }]
        ] as any[]
      };

      // Add explorer link if settled and we have a network match
      if (shift.status === 'settled' && explorerUrl) {
        // Note: We'd need the transaction hash from SideShift to create the actual link
        keyboard.inline_keyboard.push([
          { text: '🔗 View on Explorer', url: explorerUrl }
        ]);
      }

      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

    } catch (error) {
      if (error instanceof SideShiftError) {
        if (error.status === 404) {
          await ctx.reply(
            `📊 *Order Status*\n\n` +
            `**Shift ID:** \`${shiftId}\`\n` +
            `**Status:** ❓ Not found\n\n` +
            'This shift ID was not found. Please check the ID and try again.',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        await ctx.reply(
          `❌ *Error checking status*\n\n` +
          `${error.message}\n\n` +
          'Please try again later.',
          { parse_mode: 'Markdown' }
        );
      } else {
        logger.error({ error, shiftId }, 'Error checking status');
        await ctx.reply(
          '❌ *Error checking status*\n\n' +
          'Please try again later or contact support.',
          { parse_mode: 'Markdown' }
        );
      }
    }
  }

  public getWebhookHandler() {
    return (req: Request, res: Response): void => {
      const startTime = Date.now();
      const userAgent = req.get('User-Agent') || 'unknown';
      const contentType = req.get('Content-Type') || 'unknown';
      const telegramSecret = req.get('X-Telegram-Bot-Api-Secret-Token') || 'none';
      
      try {
        // Log incoming webhook request with more details
        logger.info({
          userAgent,
          contentType,
          telegramSecret,
          bodySize: req.body ? JSON.stringify(req.body).length : 0,
          hasSecret: !!req.params.secret,
          path: req.path,
          url: req.url,
          method: req.method
        }, 'Incoming Telegram webhook request');

        // Validate webhook secret
        const secretParam = req.params.secret;
        const expectedSecret = this.config.webhookSecret;

        if (!expectedSecret) {
          logger.error('Webhook secret not configured on server');
          res.status(500).json({ error: 'Server configuration error' });
          return;
        }

        if (!secretParam) {
          logger.warn({ 
            path: req.path,
            params: req.params,
            query: req.query 
          }, 'Webhook request missing secret parameter');
          res.status(400).json({ error: 'Missing secret parameter' });
          return;
        }

        if (secretParam !== expectedSecret) {
          logger.warn({ 
            providedSecret: secretParam.substring(0, 5) + '...',
            expectedPrefix: expectedSecret.substring(0, 5) + '...',
            path: req.path
          }, 'Invalid webhook secret provided');
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        // Validate request body
        if (!req.body || typeof req.body !== 'object') {
          logger.warn({ body: req.body }, 'Invalid webhook body');
          res.status(400).json({ error: 'Invalid request body' });
          return;
        }

        const update = req.body as Update;
        
        // Validate update structure
        if (!update.update_id || typeof update.update_id !== 'number') {
          logger.warn({ update }, 'Invalid update structure');
          res.status(400).json({ error: 'Invalid update structure' });
          return;
        }

        // Log successful webhook processing start
        logger.info({ 
          updateId: update.update_id,
          hasMessage: 'message' in update,
          hasCallbackQuery: 'callback_query' in update,
          messageType: 'message' in update && update.message && 'text' in update.message ? 'text' : 'other',
          userId: ('message' in update && update.message?.from?.id) || 
                  ('callback_query' in update && update.callback_query?.from?.id) || null
        }, 'Processing Telegram webhook update');

        // Process the update
        this.bot.handleUpdate(update);
        
        const processingTime = Date.now() - startTime;
        logger.info({ 
          updateId: update.update_id,
          processingTime 
        }, 'Webhook processed successfully');

        res.status(200).json({ ok: true, processed_at: new Date().toISOString() });
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error({ 
          error, 
          userAgent,
          processingTime,
          body: req.body
        }, 'Telegram webhook processing error');
        
        res.status(500).json({ 
          error: 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  private async handleDepositSelection(ctx: BotContext, data: string): Promise<void> {
    let depositCoin = '';
    let depositNetwork = '';
    
    try {
      await ctx.answerCbQuery();
      
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Parse callback data: deposit_{coin}_{network}_{targetChain}_{amount}
      const parts = data.split('_');
      if (parts.length !== 5) {
        await ctx.reply('❌ Invalid selection. Please try again.');
        return;
      }

      [, depositCoin, depositNetwork] = parts;
      const [, , , targetChain, amountStr] = parts;
      const amount = parseFloat(amountStr);

      // Get quote from SideShift
      await ctx.reply('🔄 *Getting quote...*', { parse_mode: 'Markdown' });

      const targetNetwork = getNetworkByAlias(targetChain);
      if (!targetNetwork) {
        await ctx.reply('❌ Invalid target network.');
        return;
      }

      const fromCoin = `${depositCoin}-${depositNetwork}`;
      const toCoin = targetNetwork.settleCoin;

      // Get rate without amount first to avoid minimum errors
      const quote = await sideshift.getPair({
        from: fromCoin,
        to: toCoin
      });

      // Calculate estimated amounts based on the quote rate and target amount
      const targetAmount = amount; // Amount of target currency (ETH) user wants
      const estimatedDepositAmount = quote.rate ? (targetAmount / parseFloat(quote.rate)).toFixed(6) : 'TBD';
      const estimatedReceive = targetAmount.toFixed(6);

      // Check if the calculated deposit amount meets minimums
      const depositAmountFloat = parseFloat(estimatedDepositAmount);
      const asset = COMMON_DEPOSIT_ASSETS.find(a => 
        a.coin === depositCoin && a.network === depositNetwork
      );
      
      if (asset && depositAmountFloat < asset.minAmount) {
        await ctx.reply(
          `⚠️ *Minimum Amount Required*\n\n` +
          `To receive ${targetAmount} ${targetNetwork.nativeCurrency}, you would need to deposit ~${estimatedDepositAmount} ${depositCoin.toUpperCase()}.\n\n` +
          `However, the minimum for ${depositCoin.toUpperCase()} is ${asset.minAmount}.\n\n` +
          `💡 *Suggestion:* Try requesting more ${targetNetwork.nativeCurrency} (at least ${(asset.minAmount * parseFloat(quote.rate || '1')).toFixed(4)}) or choose a different deposit asset.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Update user session
      userSessions.set(userId, {
        step: 'awaiting_address',
        targetNetwork: targetChain,
        targetAmount: targetAmount,
        depositAsset: fromCoin,
        settleAsset: toCoin,
        quote,
        calculatedDepositAmount: estimatedDepositAmount,
        calculatedSettleAmount: estimatedReceive,
        timestamp: Date.now()
      });

      await ctx.reply(
        `💰 *Quote Received*\n\n` +
        `**You send:** ~${estimatedDepositAmount} ${depositCoin.toUpperCase()}\n` +
        `**You receive:** ~${estimatedReceive} ${targetNetwork.nativeCurrency}\n` +
        `**Rate:** ${quote.rate ? `1 ${depositCoin.toUpperCase()} = ${parseFloat(quote.rate).toFixed(6)} ${targetNetwork.nativeCurrency}` : 'Variable'}\n` +
        `**Network:** ${targetNetwork.networkName}\n\n` +
        `Please send your **${targetNetwork.networkName}** address where you want to receive the gas tokens:`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      logger.error({ error, data, depositCoin, depositNetwork }, 'Error handling deposit selection');
      
      if (error instanceof SideShiftError) {
        let errorMessage = `❌ *Error getting quote*\n\n${error.message}`;
        
        // Handle minimum amount errors specifically
        if (error.message.includes('below the minimum')) {
          const asset = COMMON_DEPOSIT_ASSETS.find(a => 
            a.coin === depositCoin && a.network === depositNetwork
          );
          if (asset) {
            errorMessage += `\n\n💡 *Tip:* Try with at least ${asset.minAmount} ${depositCoin.toUpperCase()} for this pair.`;
          }
        }
        
        await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
      } else {
        // Fallback error handling - try to extract meaningful message
        let errorMessage = '❌ An error occurred while getting the quote.';
        
        if (error && typeof error === 'object') {
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = `❌ *Error getting quote*\n\n${error.message}`;
          } else if ('toString' in error) {
            const errorStr = error.toString();
            if (errorStr !== '[object Object]') {
              errorMessage = `❌ *Error getting quote*\n\n${errorStr}`;
            }
          }
        }
        
        await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
      }
    }
  }

  private async handleAddressInput(ctx: BotContext, address: string): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      const session = userSessions.get(userId);
      if (!session || session.step !== 'awaiting_address') {
        await ctx.reply('❌ No active session. Please start with /topup command.');
        return;
      }

      // Validate address
      const network = getNetworkByAlias(session.targetNetwork!);
      if (!network) {
        await ctx.reply('❌ Invalid network configuration.');
        return;
      }

      const validationResult = validateAddress(address, network.chainId.toString());
      if (!validationResult.isValid) {
        await ctx.reply(
          `❌ *Invalid ${network.networkName} address*\n\n` +
          `${validationResult.error || 'Please provide a valid address.'}\n` +
          `**Example:** ${getExampleAddress(network.chainId.toString())}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Create the shift
      await ctx.reply('🔄 *Creating order...*', { parse_mode: 'Markdown' });

      const shift = await sideshift.createVariableShift({
        settleAddress: address,
        depositCoin: session.quote!.depositCoin,
        settleCoin: session.quote!.settleCoin,
        depositNetwork: session.quote!.depositNetwork,
        settleNetwork: session.quote!.settleNetwork,
        affiliateId: process.env.SIDESHIFT_AFFILIATE_ID
      });

      // Clear session
      userSessions.delete(userId);

      // Generate QR code for deposit address
      let qrBuffer: Buffer | null = null;
      try {
        const { generateQRCode } = await import('../utils/qr');
        const qrString = await generateQRCode(shift.depositAddress);
        qrBuffer = Buffer.from(qrString.replace(/^data:image\/png;base64,/, ''), 'base64');
      } catch (error) {
        logger.warn({ error }, 'Failed to generate QR code');
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: '📊 Check Status', callback_data: `status_${shift.id}` }]
        ] as any[]
      };

      let message = 
        `✅ *Order Created Successfully!*\n\n` +
        `**Shift ID:** \`${shift.id}\`\n` +
        `**Deposit Address:**\n\`${shift.depositAddress}\`\n\n` +
        `**Send:** ${session.calculatedDepositAmount} ${session.quote!.depositCoin.toUpperCase()}\n` +
        `**Receive:** ~${session.calculatedSettleAmount} ${session.quote!.settleCoin.toUpperCase()} on ${network.networkName}\n` +
        `**To address:** \`${address}\`\n\n` +
        `⏰ **Order expires in:** ${Math.ceil((new Date(shift.expiresAt).getTime() - Date.now()) / (1000 * 60))} minutes\n\n` +
        `Use \`/status ${shift.id}\` to track your order.`;

      if (qrBuffer) {
        await ctx.replyWithPhoto(
          { source: qrBuffer },
          {
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }

    } catch (error) {
      if (error instanceof SideShiftError) {
        await ctx.reply(
          `❌ *Error creating order*\n\n${error.message}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        logger.error({ error }, 'Error handling address input');
        await ctx.reply('❌ An error occurred. Please try again.');
      }
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
        '❌ *Top-up cancelled*\n\n' +
        'You can start a new top-up anytime with the /topup command.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error({ error }, 'Error handling cancel topup');
    }
  }

  public async setWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const url = `https://api.telegram.org/bot${this.token}/setWebhook`;
      const response = await request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: this.config.webhookSecret
        })
      });

      const result = await response.body.json() as any;

      if (result.ok) {
        logger.info({ webhookUrl }, 'Telegram webhook set successfully');
        return true;
      } else {
        logger.error({ result }, 'Failed to set Telegram webhook');
        return false;
      }
    } catch (error) {
      logger.error({ error, webhookUrl }, 'Error setting Telegram webhook');
      return false;
    }
  }
}

export function createTelegramBot(): TelegramBotService | null {
  const config = createBotConfig();
  
  if (!config.botToken) {
    logger.warn('TELEGRAM_BOT_TOKEN not configured, Telegram bot disabled');
    return null;
  }

  try {
    const bot = new TelegramBotService(config.botToken, config.appBaseUrl);
    return bot;
  } catch (error) {
    logger.error({ error }, 'Failed to create Telegram bot');
    return null;
  }
}

export default createTelegramBot;