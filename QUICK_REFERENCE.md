# 🚀 OctaneShift API - Quick Reference

## 🆕 New Features (Phases 12-14)

### 📮 Webhooks (Phase 12)

**Endpoints:**

```bash
# Get webhook statistics
GET /api/webhooks/stats

# List all webhooks
GET /api/webhooks

# Get specific webhook
GET /api/webhooks/:id

# View dead letter queue
GET /api/webhooks/dead-letter/queue

# Retry failed webhook (requires WEBHOOK_SECRET)
POST /api/webhooks/dead-letter/:id/retry

# Send test webhook
POST /api/webhooks/test
Body: { "url": "https://your-webhook-url", "secret": "optional-secret" }

# Cleanup old webhooks
DELETE /api/webhooks/cleanup?maxAgeHours=24
```

**Authentication:** User Bearer token required

**Features:**

- ✅ Exponential backoff retry: 1s → 5s → 25s
- ✅ Dead letter queue for failed webhooks
- ✅ HMAC SHA-256 signature verification
- ✅ 10-second timeout per attempt
- ✅ Comprehensive logging and statistics

---

### 🔧 Background Jobs (Phase 13)

**Auto-runs on server startup:**

- Cleanup jobs every 24 hours
- Scans for old shifts (30+ days, settled/refunded)
- Scans for stale alerts (30+ days)

**Manual trigger:**

```bash
POST /api/admin/jobs/cleanup
Authorization: Bearer <ADMIN_API_KEY>
```

**Status check:**

```bash
GET /api/admin/stats
# Returns background jobs status in response
```

---

### 👨‍💼 Admin API (Phase 14)

**Authentication:**

```bash
Authorization: Bearer <ADMIN_API_KEY>
```

**Endpoints:**

#### System Statistics

```bash
GET /api/admin/stats

# Returns:
# - User counts (total, active, with Telegram/email)
# - Watchlist counts by chain
# - Shift counts by status and type
# - Alert counts by level
# - Background jobs status
```

#### User Management

```bash
GET /api/admin/users?page=1&limit=50&search=email@example.com

# Returns:
# - Paginated user list
# - Shift/watchlist/alert counts per user
# - Last shift timestamp
# - Sorted by most recent activity
```

#### Shift Management

```bash
GET /api/admin/shifts?page=1&limit=50&status=pending&userId=xxx&type=fixed

# Filters:
# - status: waiting|pending|processing|settled|refunding|refunded
# - userId: filter by specific user
# - type: fixed|variable
```

#### Alert Management

```bash
GET /api/admin/alerts?page=1&limit=50&level=critical&userId=xxx

# Filters:
# - level: low|critical
# - userId: filter by specific user
# - Includes watchlist info (address, chain)
```

---

## 🔐 Required Environment Variables

### Essential (Must Configure)

```bash
# SideShift API
SIDESHIFT_SECRET=your_sideshift_private_key
AFFILIATE_ID=your_affiliate_id

# Security Keys (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<64-char-hex-string>
WEBHOOK_SECRET=<64-char-hex-string>
ADMIN_API_KEY=<64-char-hex-string>

# Telegram (optional but recommended)
TELEGRAM_BOT_TOKEN=your_bot_token
```

### Generate Security Keys

```bash
# Generate all three keys at once
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex')); console.log('WEBHOOK_SECRET=' + require('crypto').randomBytes(32).toString('hex')); console.log('ADMIN_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🧪 Testing the New Features

### Test Webhooks

```bash
# 1. Send a test webhook
curl -X POST http://localhost:3000/api/webhooks/test \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3001/webhook",
    "secret": "test-secret"
  }'

# 2. Check webhook stats
curl http://localhost:3000/api/webhooks/stats \
  -H "Authorization: Bearer <user-token>"

# 3. View dead letter queue (after retries fail)
curl http://localhost:3000/api/webhooks/dead-letter/queue \
  -H "Authorization: Bearer <user-token>"
```

### Test Admin API

```bash
# 1. Get system stats
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer <your-admin-api-key>"

# 2. List users
curl http://localhost:3000/api/admin/users?page=1&limit=10 \
  -H "Authorization: Bearer <your-admin-api-key>"

# 3. Trigger cleanup jobs
curl -X POST http://localhost:3000/api/admin/jobs/cleanup \
  -H "Authorization: Bearer <your-admin-api-key>"
```

### Test Background Jobs

```bash
# Check if jobs are running
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer <your-admin-api-key>" | jq '.stats.backgroundJobs'

# Expected output:
# {
#   "running": true,
#   "intervals": { "cleanupHours": 24 },
#   "maxAge": { "shiftDays": 30, "alertDays": 30 }
# }
```

---

## 📊 Rate Limits

| Endpoint           | Rate Limit   | Window              |
| ------------------ | ------------ | ------------------- |
| Shift Creation     | 5 requests   | per hour per user   |
| Top-up Creation    | 10 requests  | per 30 min per user |
| Watchlist Creation | 20 requests  | per hour per user   |
| General API        | 100 requests | per 15 min          |
| Admin API          | 10 requests  | per 15 min          |
| Health Checks      | 60 requests  | per minute          |

---

## 🔒 Security Features

- ✅ **Input Sanitization** - Removes malicious code from inputs
- ✅ **Request Signature Validation** - Prevents replay attacks (5-min window)
- ✅ **CSRF Protection** - Token validation for state-changing operations
- ✅ **Security Headers** - X-Frame-Options, X-Content-Type-Options, etc.
- ✅ **Admin API Key Auth** - Timing-safe comparison
- ✅ **Webhook Signatures** - HMAC SHA-256 verification
- ✅ **Rate Limiting** - Per-user and per-endpoint limits

---

## 💰 Compliance Features

### Transaction Limits by KYC Level

| Level      | Per Shift | Per Day  |
| ---------- | --------- | -------- |
| Unverified | $1,000    | $2,000   |
| Basic KYC  | $5,000    | $10,000  |
| Full KYC   | $50,000   | $100,000 |

### Requirements

- Unverified: Shifts over $1,000 blocked
- Basic KYC: Required for $1,000-$10,000
- Full KYC: Required for $10,000+

---

## 📝 Common Tasks

### Create Test User

```bash
curl -X POST http://localhost:3000/api/test/store/user \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","regionStatus":"allowed"}'

# Returns: { "success": true, "user": { "id": "..." } }
# Use the "id" as Bearer token for authenticated requests
```

### Check System Health

```bash
# Quick health check
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/api/health

# Admin statistics (requires admin key)
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer <admin-key>"
```

### Monitor Webhooks

```bash
# View all webhooks
curl http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer <user-token>"

# Check statistics
curl http://localhost:3000/api/webhooks/stats \
  -H "Authorization: Bearer <user-token>"

# View failed webhooks
curl http://localhost:3000/api/webhooks/dead-letter/queue \
  -H "Authorization: Bearer <user-token>"
```

---

## 🐛 Troubleshooting

### Issue: "Admin API not available"

**Solution:** Set `ADMIN_API_KEY` in `.env` file (min 32 chars)

### Issue: "Invalid admin API key"

**Solution:**

1. Check your `.env` file for the correct key
2. Verify Authorization header: `Bearer <key>`
3. Ensure no spaces/newlines in the key

### Issue: Webhooks not delivering

**Solution:**

1. Check target URL is accessible
2. Review logs: `GET /api/webhooks`
3. Check dead letter queue for errors
4. Verify WEBHOOK_SECRET if using retry

### Issue: Background jobs not running

**Solution:**

1. Check server logs on startup
2. Verify `GET /api/admin/stats` shows `running: true`
3. Restart server to initialize jobs

---

## 📚 Documentation Files

- `ENVIRONMENT_SETUP.md` - Complete environment setup guide
- `README.md` - Project overview and getting started
- `.env.example` - Template with all variables
- This file - Quick reference for new features

---

## 🎯 Next Steps

1. ✅ Configure all required environment variables
2. ✅ Test webhook delivery and retry logic
3. ✅ Set up admin access with secure API key
4. ✅ Monitor background jobs execution
5. ⏳ Phase 15: Write integration tests
6. ⏳ Phase 15: Set up monitoring/alerting
7. ⏳ Phase 15: Create API documentation (Swagger)
8. ⏳ Phase 15: Production deployment checklist

---

**Last Updated:** November 11, 2025
**Current Version:** 1.0.0 (Phases 0-14 Complete)
