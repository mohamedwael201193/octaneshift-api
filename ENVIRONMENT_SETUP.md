# Environment Setup Guide

This guide explains all environment variables required for OctaneShift API.

## Quick Start

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Update the following required variables:
   - `SIDESHIFT_SECRET` - Get from https://sideshift.ai/account
   - `AFFILIATE_ID` - Get from https://sideshift.ai/account
   - `TELEGRAM_BOT_TOKEN` - Create bot with @BotFather on Telegram
   - `JWT_SECRET` - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `WEBHOOK_SECRET` - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_API_KEY` - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Environment Variables Reference

### Server Configuration

| Variable          | Required | Default       | Description                                              |
| ----------------- | -------- | ------------- | -------------------------------------------------------- |
| `PORT`            | No       | `3000`        | Server port                                              |
| `NODE_ENV`        | No       | `development` | Environment: `development`, `staging`, `production`      |
| `FRONTEND_ORIGIN` | Yes      | -             | CORS allowed origin for frontend                         |
| `APP_BASE_URL`    | Yes      | -             | Base URL for API (used in webhooks, deep links)          |
| `PUBLIC_APP_URL`  | Yes      | -             | Public frontend URL                                      |
| `DEMO_MODE`       | No       | `false`       | Enable demo mode (disables real transactions)            |
| `COMPLIANCE_MODE` | No       | `development` | Compliance level: `development`, `staging`, `production` |

### SideShift Configuration

| Variable           | Required | Default | Description                    |
| ------------------ | -------- | ------- | ------------------------------ |
| `SIDESHIFT_SECRET` | Yes      | -       | Your SideShift API private key |
| `AFFILIATE_ID`     | Yes      | -       | Your SideShift affiliate ID    |
| `COMMISSION_RATE`  | No       | `0.0`   | Commission rate (0.0 to 1.0)   |

**How to get SideShift credentials:**

1. Visit https://sideshift.ai
2. Create an account
3. Go to Account Settings → API
4. Copy your Private Key and Affiliate ID

### Telegram Bot Configuration

| Variable                  | Required | Default | Description                          |
| ------------------------- | -------- | ------- | ------------------------------------ |
| `TELEGRAM_BOT_TOKEN`      | Yes      | -       | Telegram bot token from @BotFather   |
| `TELEGRAM_ADMIN_CHAT_ID`  | No       | -       | Admin chat ID for alerts             |
| `TELEGRAM_WEBHOOK_SECRET` | No       | -       | Secret for webhook endpoint security |
| `TELEGRAM_ALERTS_ENABLED` | No       | `false` | Enable Telegram notifications        |
| `EMAIL_ALERTS_ENABLED`    | No       | `false` | Enable email notifications           |

**How to create a Telegram bot:**

1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Follow the prompts to name your bot
4. Copy the bot token provided
5. To get your chat ID, message @userinfobot

### Security Configuration

| Variable         | Required | Default | Description                                  |
| ---------------- | -------- | ------- | -------------------------------------------- |
| `JWT_SECRET`     | Yes      | -       | Secret for JWT tokens (min 32 chars)         |
| `WEBHOOK_SECRET` | Yes      | -       | Secret for webhook signatures (min 32 chars) |
| `ADMIN_API_KEY`  | Yes      | -       | Admin API authentication key (min 32 chars)  |

**Generate secure keys:**

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate WEBHOOK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### RPC Provider Configuration

| Variable                 | Required | Default | Description                 |
| ------------------------ | -------- | ------- | --------------------------- |
| `PROVIDER_RPC_URLS_JSON` | No       | `{}`    | JSON map of chain → RPC URL |

**Format:**

```json
{
  "eth": "https://eth.llamarpc.com",
  "base": "https://mainnet.base.org",
  "arb": "https://arb1.arbitrum.io/rpc",
  "op": "https://mainnet.optimism.io",
  "pol": "https://polygon-rpc.com",
  "avax": "https://api.avax.network/ext/bc/C/rpc"
}
```

**Recommended RPC Providers:**

- **Free Tier:** LlamaRPC, public endpoints (rate limited)
- **Paid Tier:** Alchemy, Infura, QuickNode, Ankr (for production)

### Logging Configuration

| Variable    | Required | Default | Description                                 |
| ----------- | -------- | ------- | ------------------------------------------- |
| `LOG_LEVEL` | No       | `info`  | Log level: `debug`, `info`, `warn`, `error` |

## New Features (Phases 12-14)

### Phase 12: Webhooks

- **WEBHOOK_SECRET**: Used for HMAC signature verification when retrying webhooks from dead letter queue
- Enables secure webhook delivery with exponential backoff retry [1s, 5s, 25s]
- Dead letter queue for failed webhooks
- Webhook endpoints require user authentication (Bearer token)

### Phase 13: Background Jobs

Background jobs run automatically on server startup:

- **Cleanup jobs**: Run every 24 hours
  - Remove old shifts (30+ days, status: settled/refunded)
  - Remove stale alerts (30+ days)
- **Manual trigger**: Use admin API endpoint

### Phase 14: Admin API

- **ADMIN_API_KEY**: Required for all admin endpoints
- **Authentication**: Use `Authorization: Bearer <ADMIN_API_KEY>` header
- **Admin Endpoints:**
  - `GET /api/admin/stats` - System-wide statistics
  - `GET /api/admin/users` - User management (paginated, searchable)
  - `GET /api/admin/shifts` - All shifts with filters
  - `GET /api/admin/alerts` - System alerts with filters
  - `POST /api/admin/jobs/cleanup` - Manually trigger cleanup

## Testing Setup

For local development and testing:

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Update .env with your values (minimum required):
# - SIDESHIFT_SECRET
# - AFFILIATE_ID
# - JWT_SECRET (generate with crypto)
# - WEBHOOK_SECRET (generate with crypto)
# - ADMIN_API_KEY (generate with crypto)

# 4. Build TypeScript
npm run build

# 5. Start server
npm start

# 6. Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/health

# 7. Test admin API
curl -H "Authorization: Bearer <your-admin-key>" \
  http://localhost:3000/api/admin/stats

# 8. Test webhooks
curl -X POST \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/test","secret":"test"}' \
  http://localhost:3000/api/webhooks/test
```

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong random secrets (32+ chars)
- [ ] Set `COMPLIANCE_MODE=production`
- [ ] Configure private RPC providers (Alchemy/Infura)
- [ ] Enable HTTPS/SSL
- [ ] Set proper `FRONTEND_ORIGIN` and CORS
- [ ] Configure rate limiting for your traffic
- [ ] Set up monitoring/alerting
- [ ] Enable `TELEGRAM_ALERTS_ENABLED` if using Telegram
- [ ] Backup `JWT_SECRET`, `WEBHOOK_SECRET`, `ADMIN_API_KEY` securely
- [ ] Review and test all admin endpoints
- [ ] Set up log aggregation (Datadog, Papertrail, etc.)
- [ ] Configure automatic backups for `data/store.json`

## Troubleshooting

### "Admin API not available"

- Check that `ADMIN_API_KEY` is set in `.env`
- Ensure the key is at least 32 characters

### "Invalid admin API key"

- Verify you're using the correct key from `.env`
- Check Authorization header format: `Bearer <key>`
- Ensure no extra spaces or newlines in the key

### Webhook delivery failures

- Check `WEBHOOK_SECRET` is set if using retry endpoints
- Verify target URL is accessible
- Check webhook logs in `/api/webhooks` endpoint
- Review dead letter queue: `/api/webhooks/dead-letter/queue`

### RPC connection issues

- Verify `PROVIDER_RPC_URLS_JSON` is valid JSON
- Test RPC URLs with curl
- Consider using paid RPC providers for production
- Check rate limits on free RPCs

## Security Best Practices

1. **Never commit `.env` to git** - It's in `.gitignore`
2. **Rotate secrets regularly** - Especially after team changes
3. **Use different keys per environment** - dev/staging/production
4. **Store secrets securely** - Use secret managers (AWS Secrets Manager, etc.)
5. **Monitor admin API usage** - Set up alerts for suspicious activity
6. **Implement IP whitelisting** - For admin endpoints in production
7. **Enable request logging** - For audit trails
8. **Regular security audits** - Review access logs and API usage

## Support

For issues or questions:

- Check logs: `tail -f logs/combined.log`
- Review API documentation
- Test endpoints with provided curl examples
- Check Background Jobs status: `GET /api/admin/stats` (includes job status)
