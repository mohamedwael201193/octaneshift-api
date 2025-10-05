# OctaneShift API

A robust Node.js TypeScript Express API for OctaneShift cryptocurrency exchange integration.

## Features

- 🚀 **Express Server** with TypeScript
- 🛡️ **Security** with Helmet and CORS
- � **Compliance Gate** with geo-restriction checking
- 🏛️ **Legal Compliance** returns 451 for restricted regions
- �📝 **Structured Logging** with Pino and data masking
- 🔒 **Rate Limiting** with configurable limits
- ✅ **Runtime Validation** with Zod
- 🌐 **SideShift Integration** for crypto exchanges
- 🤖 **Telegram Bot** for notifications
- 📊 **QR Code Generation** for deposit addresses
- 🔍 **Client IP Extraction** (proxy-aware)
- 🚨 **Global Error Handling** with Problem+JSON responses
- ⚡ **Health Checks** for monitoring
- 🏗️ **Infrastructure as Code** with Render

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd octaneshift-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Development
npm run dev

# Production build
npm run build
npm start
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
APP_BASE_URL=https://octaneshift-api.onrender.com

# SideShift Configuration
SIDESHIFT_SECRET=your_sideshift_secret
AFFILIATE_ID=your_affiliate_id
COMMISSION_RATE=0

# Compliance & Demo Mode
DEMO_MODE=false.0

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Logging
LOG_LEVEL=info
```

## Telegram Bot Setup

The API includes automatic Telegram webhook setup on server start. Here's how to configure it:

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Use `/newbot` command and follow instructions
3. Copy the bot token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. Get Your Admin Chat ID

1. Message your bot or add it to a group
2. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find the `chat.id` from the response
4. Use this as `TELEGRAM_ADMIN_CHAT_ID`

### 3. Set Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here
TELEGRAM_WEBHOOK_SECRET=some-random-secret
APP_BASE_URL=https://your-app-domain.com
```

### 4. Automatic Webhook Setup

When the server starts, it will automatically:

- Check current webhook configuration
- Set webhook to `{APP_BASE_URL}/webhook/telegram`
- Configure webhook secret for security
- Log success/failure in server logs

### 5. Manual Webhook Management

You can also manage webhooks manually:

```bash
# Get current webhook info
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Set webhook manually
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook/telegram",
    "secret_token": "your-webhook-secret"
  }'

# Delete webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook
```

## API Endpoints

### Health Check

- `GET /health` - System health status

### SideShift API

- `GET /api/permissions` - Get user permissions from SideShift (includes x-user-ip header)
- `GET /api/pair?from=COIN-NET&to=COIN-NET&amount=NUM` - Get trading pair info (cached 30s)
- `POST /api/shifts/variable` - Create a variable shift (returns depositAddress, depositMemo, depositMin/Max, expiresAt, id)
- `GET /api/shifts/:id` - Get shift status and details

### Telegram Webhook (if configured)

- `POST /webhook/telegram` - Telegram bot webhook endpoint

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run type-check` - Check TypeScript types
- `npm run lint` - Lint code with ESLint

## Architecture

### Middleware Stack

1. **Trust Proxy** - For Render deployment
2. **Helmet** - Security headers
3. **CORS** - Cross-origin resource sharing
4. **Pino HTTP** - Request logging
5. **Body Parsing** - JSON/URL-encoded (1MB limit)
6. **IP Extraction** - Real client IP detection
7. **Rate Limiting** - Per-endpoint rate limits
8. **Routes** - API endpoints
9. **404 Handler** - Not found responses
10. **Error Handler** - Global error handling

### Project Structure

```
src/
├── index.ts              # Main server file
├── lib/
│   └── sideshift.ts      # SideShift API client
├── routes/
│   └── sideshift.ts      # SideShift route handlers
├── middleware/
│   ├── ip.ts             # Client IP extraction
│   ├── errors.ts         # Error handling
│   └── rateLimit.ts      # Rate limiting config
├── bot/
│   └── telegram.ts       # Telegram bot integration
└── utils/
    ├── logger.ts         # Pino logger setup
    └── qr.ts             # QR code generation
```

## Features Detail

### Compliance & Legal Requirements

The API includes a comprehensive compliance gate that:

- **Permission Checking**: Calls SideShift's `getPermissions` API with user IP
- **Geo-Restriction**: Returns HTTP 451 (Unavailable For Legal Reasons) for restricted regions
- **Demo Mode**: Set `DEMO_MODE=true` to bypass permission checks for read-only operations
- **Applied to Routes**:
  - `POST /api/shifts/variable` (always checked)
  - `GET /api/pair` (checked unless `DEMO_MODE=true`)

**Example 451 Response:**

```json
{
  "type": "about:blank#region-restricted",
  "title": "Unavailable For Legal Reasons",
  "status": 451,
  "detail": "Not available in your region.",
  "restricted": true,
  "country": "XX",
  "message": "Not available in your region."
}
```

### Privacy & Data Protection

**Automatic Data Masking in Logs:**

- **IP Addresses**: Last octet masked (`192.168.1.***`)
- **Wallet Addresses**: Last 6 characters masked (`1A1zP1eP5Q...******`)
- **Sensitive Fields**: Authorization headers, cookies, tokens redacted

**Protected Fields:**

- `userIp`, `settleAddress`, `depositAddress`, `refundAddress`
- All authorization and authentication data
- Private keys, mnemonics, secrets

### Client IP Extraction

- Extracts real client IP from `x-forwarded-for` header
- Handles proxy environments (Render, Cloudflare, etc.)
- Falls back to `req.ip` if no proxy headers
- Exposes IP via `req.userIp`

### Error Handling

- **Problem+JSON** responses (RFC 7807)
- Custom error classes (`APIError`, `ValidationError`, etc.)
- Zod validation error handling
- Request ID tracking
- Structured error logging

### Rate Limiting

- **General**: 100 requests/15 minutes per IP
- **Strict**: 10 requests/15 minutes per IP (sensitive endpoints)
- **Health**: 60 requests/minute per IP
- Monitoring service bypass for health checks

### Telegram Integration

- Order creation notifications
- Status update alerts
- Error notifications
- System status updates
- Admin command handling

### Security

- Helmet security headers
- Strict CORS policy
- Request size limits (1MB)
- Rate limiting
- Input validation with Zod
- Sensitive data redaction in logs

## Deployment

### Deploy to Render

The project includes `render.yaml` for automatic deployment. Follow these steps:

#### 1. Fork & Connect Repository

1. Fork this repository to your GitHub account
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository

#### 2. Configure Environment Variables

Set these environment variables in Render dashboard:

| Variable                  | Value                           | Description                |
| ------------------------- | ------------------------------- | -------------------------- |
| `SIDESHIFT_SECRET`        | `your_secret_key`               | SideShift API secret       |
| `AFFILIATE_ID`            | `your_affiliate_id`             | SideShift affiliate ID     |
| `COMMISSION_RATE`         | `0.0`                           | Commission rate (auto-set) |
| `FRONTEND_ORIGIN`         | `https://your-frontend.com`     | CORS origin                |
| `TELEGRAM_BOT_TOKEN`      | `bot_token_from_botfather`      | Telegram bot token         |
| `TELEGRAM_WEBHOOK_SECRET` | `random_secret_string`          | Webhook security           |
| `APP_BASE_URL`            | `https://your-app.onrender.com` | Set after deploy           |

#### 3. Deploy

1. Render automatically detects `render.yaml` configuration
2. Click "Create Web Service"
3. Deployment starts automatically
4. Copy your app URL (e.g., `https://octaneshift-api.onrender.com`)
5. Update `APP_BASE_URL` environment variable with your URL
6. Redeploy to activate Telegram webhook

#### 4. Verify Deployment

Test your API with curl:

```bash
# Health check
curl https://your-app.onrender.com/health

# Expected response:
{
  "ok": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0"
}

# Test SideShift permissions endpoint
curl https://your-app.onrender.com/api/permissions

# Test Telegram webhook (should return 401 without secret)
curl -X POST https://your-app.onrender.com/webhook/telegram/wrong-secret
```

#### 5. Configure Telegram Bot (Optional)

If using Telegram notifications:

```bash
# Check webhook status
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo

# Your webhook should be automatically configured to:
# https://your-app.onrender.com/webhook/telegram/<WEBHOOK_SECRET>
```

### Alternative Deployment

For other platforms, ensure:

- Node.js 20+ runtime
- Set `trust proxy` for reverse proxy environments
- Configure all required environment variables
- Use `npm ci && npm run build` for building
- Start with `node dist/index.js`

### Environment Variables (Production)

Set these secrets in your deployment platform:

- `FRONTEND_ORIGIN`
- `SIDESHIFT_AFFILIATE_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`

## Monitoring

### Health Endpoint

The `/health` endpoint returns:

```json
{
  "ok": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "commit": "abc1234"
}
```

### Logging

- Structured JSON logs with Pino
- Request/response logging
- Error tracking with context
- Sensitive data redaction
- Development-friendly pretty printing

## License

MIT License - see LICENSE file for details.
