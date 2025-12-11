# 🚀 OctaneShift - Instant Gas Token Service

**A comprehensive platform for acquiring gas tokens across multiple EVM chains instantly.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://octaneshift.vercel.app)
[![API](https://img.shields.io/badge/API-Live-green)](https://octaneshift-api-1.onrender.com)
[![Bot](https://img.shields.io/badge/Telegram-Bot-blue)](https://t.me/OctaneShift_Bot)

## 📋 Table of Contents

- [Overview](#overview)
- [Wave 2 Features](#wave-2-features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Telegram Bot](#telegram-bot)
- [Frontend Features](#frontend-features)
- [Testing Guide](#testing-guide)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

---

## 🎯 Overview

OctaneShift is a **complete gas token acquisition platform** that evolved from a simple SideShift wrapper (Wave 1) to a full-featured service (Wave 2) with:

- 🌐 **Web Interface**: React + TypeScript frontend with modern UI/UX
- 🤖 **Telegram Bot**: Full bot integration for mobile-first users
- ⚡ **Backend API**: Express + TypeScript with SideShift v2 integration
- � **Real-time Monitoring**: Status dashboard with live metrics
- 🎁 **Gift System**: Send gas tokens to friends via shareable links
- 📦 **Batch Processing**: Top up 50 addresses in one operation
- 🔗 **Deep Links**: Direct navigation from alerts to pre-filled forms
- 🎚️ **Preset Amounts**: Quick-select common gas amounts
- 📜 **Proof of Payment**: Blockchain-verifiable transaction proof

### Wave 1 → Wave 2 Evolution

| Feature                | Wave 1                      | Wave 2                          |
| ---------------------- | --------------------------- | ------------------------------- |
| **Core Functionality** | Basic SideShift API wrapper | Full platform with 15+ features |
| **User Interface**     | Single swap form            | 9 pages with navigation         |
| **Mobile Experience**  | Web only                    | Telegram bot + web              |
| **Batch Operations**   | ❌                          | ✅ Up to 50 addresses           |
| **Gifting**            | ❌                          | ✅ Shareable gift links         |
| **Monitoring**         | ❌                          | ✅ Watchlist + alerts           |
| **Presets**            | ❌                          | ✅ Quick amount selection       |
| **Deep Links**         | ❌                          | ✅ Alert → pre-filled form      |
| **Proof System**       | ❌                          | ✅ Blockchain explorer links    |
| **Status Dashboard**   | ❌                          | ✅ Real-time metrics            |

---

## 🎁 Wave 2 Features

### 1️⃣ **Preset Quick Amounts**

- Pre-configured gas amounts ($5, $10, $20, $50)
- One-click selection for common top-up scenarios
- Visual cards with chain logos and descriptions
- **Route**: `/presets`

### 2️⃣ **Batch Gas Top-Up**

- Upload CSV with up to 50 addresses
- Bulk send gas tokens to multiple wallets
- Progress tracking for each transaction
- Support for memo/tags (XRP, XLM, EOS)
- **Route**: `/batch`
- **Format**: `address,amount,memo` (memo optional)

### 3️⃣ **Gift Cards (Shareable Gas)**

- Create shareable gift links for gas tokens
- Claim with one click - no wallet needed upfront
- Perfect for onboarding new users
- Expires after 7 days
- **Routes**: `/gift/create`, `/gift/:id`

### 4️⃣ **Deep Links**

- Direct navigation from alerts/messages to pre-filled forms
- Format: `/deeplink?chain=base&amount=5&address=0x...`
- Validates parameters before rendering
- **Route**: `/deeplink`

### 5️⃣ **Notification System**

- Watchlist monitoring for low gas balances
- Real-time alerts via Telegram
- Deep link integration for quick top-ups
- **Backend**: `/api/watchlists/*`

### 6️⃣ **Proof of Payment**

- Detailed transaction proof with blockchain explorer links
- Shows deposit address, settlement address, amounts, rates
- Clickable links to Etherscan, Basescan, Polygonscan, etc.
- **Routes**: `/proof/:shiftId`, `/api/proof/shift/:id`

### 7️⃣ **Status Dashboard**

- Real-time system metrics (uptime, success rate, volume)
- Top chains and coins analytics
- Shift breakdown (completed/pending/failed)
- **Test Alert Button**: Demonstrates watchlist → alert → deep link flow
- **Route**: `/status`

### 8️⃣ **Telegram Bot Integration**

- Full bot with inline buttons and conversational UI
- Commands: `/topup`, `/status`, `/shifts`, `/notifications`
- Supports all features: presets, batch, gifts
- Mobile-first experience
- **Webhook**: `/webhook/telegram/:secret`

### 9️⃣ **Memo/Tag Support**

- Automatic detection for coins requiring memos (XRP, XLM, EOS)
- Conditional field display in swap interface
- CSV batch support for memos
- **Implementation**: `SwapInterface.tsx`, `BatchTopUp.tsx`

### 🔟 **Navigation Spacing**

- Clean 80px spacing between nav and content
- Consistent across all pages
- Mobile-responsive design

---

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Frontend      │◄────►│   Backend API    │◄────►│   SideShift API │
│   (Vercel)      │      │   (Render)       │      │   (External)    │
│                 │      │                  │      │                 │
│  React + Vite   │      │  Express + TS    │      │  Crypto Swaps   │
│  TanStack Query │      │  Zod Validation  │      │  Quote Engine   │
│  Framer Motion  │      │  Rate Limiting   │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │  Telegram Bot    │
                         │  (Webhook)       │
                         │                  │
                         │  Commands        │
                         │  Notifications   │
                         └──────────────────┘
```

### Tech Stack

**Backend:**

- Express.js 4.18+ (REST API)
- TypeScript 5.3+ (Type safety)
- Zod (Runtime validation)
- Pino (Structured logging)
- Undici (HTTP client)
- Telegraf (Telegram bot framework)

**Frontend:**

- React 18 (UI library)
- Vite (Build tool)
- React Router v7 (Navigation)
- TanStack Query (Data fetching)
- Framer Motion (Animations)
- Tailwind CSS (Styling)
- Lucide React (Icons)

**Infrastructure:**

- Render (Backend hosting)
- Vercel (Frontend hosting)
- SideShift API (Crypto swaps)
- Telegram Bot API (Notifications)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- SideShift API secret
- Telegram bot token (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/mohamedwael201193/octaneshift-api.git
cd octaneshift-api

# Install backend dependencies
npm install

# Install frontend dependencies
cd web
npm install
cd ..

# Configure environment
cp .env.example .env
# Edit .env with your values

# Start backend (development)
npm run dev

# Start frontend (in separate terminal)
cd web
npm run dev
```

### Environment Variables

Create `.env` file in project root:

````env
```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173,https://octaneshift.vercel.app
APP_BASE_URL=https://octaneshift-api-1.onrender.com

# SideShift Configuration
SIDESHIFT_SECRET=your_sideshift_secret
AFFILIATE_ID=your_affiliate_id
COMMISSION_RATE=0

# Compliance & Demo Mode
DEMO_MODE=false

# Telegram Bot Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# Logging
LOG_LEVEL=info
````

---

## 📡 API Documentation

### Base URL

- **Production**: `https://octaneshift-api-1.onrender.com`
- **Development**: `http://localhost:3000`

### Core Endpoints

#### Health Check

```http
GET /health
```

Response:

```json
{
  "ok": true,
  "timestamp": "2025-11-12T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

#### Wave 2 Endpoints

**1. Presets (Quick Amounts)**

```http
GET /api/presets
```

Returns preset gas amounts for quick selection.

**2. Batch Top-Up**

```http
POST /api/topup/batch
Content-Type: application/json

{
  "items": [
    {
      "chain": "base",
      "settleAddress": "0x123...",
      "settleAmount": "5",
      "memo": "optional"
    }
  ]
}
```

**3. Gift Creation**

```http
POST /api/gifts
Content-Type: application/json

{
  "chain": "eth",
  "amount": "10",
  "message": "Welcome gift!"
}
```

**4. Gift Claim**

```http
GET /api/gifts/:giftId
```

**5. Deep Link Validation**

```http
GET /api/deeplink/validate?chain=base&amount=5&address=0x...
```

**6. Proof of Payment**

```http
GET /api/proof/shift/:shiftId
```

Returns detailed transaction proof with explorer links.

**7. Status Dashboard**

```http
GET /api/status
```

Returns real-time metrics:

```json
{
  "success": true,
  "data": {
    "uptime": { "seconds": 180, "formatted": "3m" },
    "shifts": {
      "today": 5,
      "last24h": 12,
      "completed": 10,
      "failed": 1,
      "pending": 1
    },
    "successRate": 90.9,
    "topChains": [{ "chain": "base", "count": 6 }],
    "topCoins": [{ "coin": "USDT", "count": 8 }]
  }
}
```

**8. Test Alert**

```http
POST /api/test-alert
```

Generates test watchlist alert with deep link (for demo purposes).

### SideShift Integration

**Get Quote**

```http
GET /api/pair?from=usdt-ethereum&to=eth-base&amount=10
```

**Create Shift**

```http
POST /api/shifts/variable
Content-Type: application/json

{
  "depositCoin": "USDT",
  "depositNetwork": "ethereum",
  "settleCoin": "ETH",
  "settleNetwork": "base",
  "settleAddress": "0x123...",
  "settleMemo": "optional-for-xrp-xlm-eos"
}
```

**Get Shift Status**

```http
GET /api/shifts/:shiftId
```

---

## 🤖 Telegram Bot

### Setup Instructions

1. **Create Bot**

   - Message [@BotFather](https://t.me/BotFather)
   - Use `/newbot` command
   - Copy bot token

2. **Get Chat ID**

   - Message your bot
   - Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Find `chat.id` in response

3. **Configure Environment**

   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   TELEGRAM_ADMIN_CHAT_ID=123456789
   TELEGRAM_WEBHOOK_SECRET=random-secret
   APP_BASE_URL=https://your-app.onrender.com
   ```

4. **Deploy**
   - Webhook automatically configured on server start
   - URL: `{APP_BASE_URL}/webhook/telegram/{WEBHOOK_SECRET}`

### Bot Commands

| Command          | Description                         |
| ---------------- | ----------------------------------- |
| `/start`         | Welcome message with main menu      |
| `/topup`         | Start gas top-up flow               |
| `/status`        | View order status                   |
| `/shifts`        | List recent shifts                  |
| `/notifications` | Manage notification settings        |
| `/cancel_order`  | Cancel pending order                |
| `/test`          | Test bot connectivity (dev mode)    |
| `/ping`          | Check bot responsiveness (dev mode) |

### Bot Features

- **Interactive Menus**: Inline buttons for easy navigation
- **Step-by-step Flow**: Guided process for creating orders
- **Real-time Updates**: Order status notifications
- **Error Handling**: User-friendly error messages
- **Preset Integration**: Quick amount selection
- **Batch Support**: Upload CSV for bulk operations
- **Gift Cards**: Create and claim gas gifts

### Bot Flow Example

```
User: /topup
Bot: 💰 Gas Top-Up
     Select target chain:
     [Ethereum] [Base] [Polygon] [Arbitrum] [Optimism] [Avalanche]

User: [Base]
Bot: How much gas do you need?
     [Quick Amounts: $5] [$10] [$20] [$50]
     Or enter custom amount...

User: $10
Bot: Please enter your Base wallet address...

User: 0x123...
Bot: ✅ Quote received!
     You pay: 10 USDT
     You receive: ~0.0035 ETH on Base
     Rate: 1 ETH = 2857 USDT

     [Confirm] [Cancel]

User: [Confirm]
Bot: 🎉 Order created!
     Shift ID: 80efbb...

     Send exactly 10 USDT to:
     0xabc...

     [Copy Address] [Track Order] [View Proof]
```

---

## 🖥️ Frontend Features

### Pages

### Pages

| Route             | Description            | Features                                                                |
| ----------------- | ---------------------- | ----------------------------------------------------------------------- |
| `/`               | Home landing page      | Hero, features showcase, how it works, supported chains, swap interface |
| `/presets`        | Quick amount selection | $5, $10, $20, $50 preset cards with chain selection                     |
| `/topup`          | Custom gas top-up      | Manual amount entry with full customization                             |
| `/batch`          | Bulk gas distribution  | CSV upload, 50 addresses max, memo support                              |
| `/gift/create`    | Create gas gift        | Shareable link generation, 7-day expiry                                 |
| `/gift/:id`       | Claim gas gift         | One-click claim, pre-filled form                                        |
| `/deeplink`       | Alert navigation       | Pre-filled from URL params (chain, amount, address)                     |
| `/status`         | System dashboard       | Real-time metrics, test alert button                                    |
| `/proof/:shiftId` | Transaction proof      | Explorer links, full transaction details                                |

### UI/UX Highlights

- **Responsive Design**: Mobile-first, works on all screen sizes
- **Dark Theme**: Modern gradient backgrounds (black → gray-900)
- **Smooth Animations**: Framer Motion for page transitions
- **Loading States**: Skeleton screens and spinners
- **Error Handling**: User-friendly error messages with retry buttons
- **Toast Notifications**: Real-time feedback for actions
- **Navigation Bar**: Fixed header with menu links and CTA button
- **Proper Spacing**: 80px gap between nav and content

### Key Components

- **SwapInterface**: Main order creation form with memo field support
- **OrderTracker**: Track shift status by ID
- **FeaturesShowcase**: Animated feature cards
- **Navigation**: Responsive nav bar with mobile menu
- **Proof Page**: Blockchain explorer integration

---

## 🧪 Testing Guide

### Manual Testing Checklist

#### 1. **Home Page** (`/`)

- ✅ Hero section loads
- ✅ Features showcase animates
- ✅ Supported chains display correctly
- ✅ Swap interface functional
- ✅ Order tracker works

#### 2. **Presets** (`/presets`)

- ✅ 4 preset cards displayed ($5, $10, $20, $50)
- ✅ Chain selection dropdown works
- ✅ Clicking preset navigates to topup with prefilled amount
- ✅ USDT amounts shown correctly (not ETH)

#### 3. **Top-Up** (`/topup`)

- ✅ Custom amount input
- ✅ Chain selector (6 chains: ETH, Base, Polygon, Arbitrum, Optimism, Avalanche)
- ✅ Quote fetches correctly
- ✅ Order creation succeeds
- ✅ Success modal shows with 3 buttons: View Proof, Track Order, New Order

#### 4. **Batch** (`/batch`)

- ✅ CSV upload works
- ✅ Manual address entry (up to 50)
- ✅ Chain selection
- ✅ Batch submission creates multiple shifts
- ✅ Results show shift IDs with "View Proof" links
- ✅ Memo field hint displayed

#### 5. **Gifts** (`/gift/create`, `/gift/:id`)

- ✅ Create gift with amount and message
- ✅ Shareable link generated
- ✅ Link opens gift page
- ✅ Claim button shows pre-filled form
- ✅ Gift expires after 7 days

#### 6. **Deep Link** (`/deeplink?chain=base&amount=5&address=0x...`)

- ✅ Validates URL parameters
- ✅ Pre-fills swap interface
- ✅ Invalid params show error
- ✅ Missing params prompt user

#### 7. **Status Dashboard** (`/status`)

- ✅ Uptime displays correctly
- ✅ Metrics update every 30 seconds
- ✅ Top chains/coins shown
- ✅ **Test Alert Button** triggers demo alert
- ✅ Alert success message displays
- ✅ Proper spacing below navigation

#### 8. **Proof Page** (`/proof/:shiftId`)

- ✅ Shift details load
- ✅ Status badge shows correct status
- ✅ Deposit address clickable → explorer
- ✅ Settlement address clickable → explorer
- ✅ Amounts, rates, fees displayed
- ✅ Timestamps formatted correctly

#### 9. **Memo Support**

- ✅ SwapInterface shows memo field for XRP/XLM/EOS
- ✅ Memo field has yellow warning border
- ✅ BatchTopUp CSV format mentions memo column
- ✅ Backend accepts memo parameter

#### 10. **Navigation**

- ✅ All nav links work
- ✅ 80px spacing between nav and content
- ✅ Mobile menu functional
- ✅ Active route highlighted

### Telegram Bot Testing

#### Prerequisites

- Bot token configured
- Webhook set up
- Admin chat ID configured

#### Test Flow

1. **Start Bot**

   ```
   /start
   ```

   Expected: Welcome message with inline buttons

2. **Create Top-Up Order**

   ```
   /topup
   → Select chain (e.g., Base)
   → Enter amount (e.g., 10)
   → Enter address (e.g., 0x...)
   → Confirm
   ```

   Expected: Order created with shift ID and deposit address

3. **Check Status**

   ```
   /status
   → Enter shift ID
   ```

   Expected: Current shift status displayed

4. **View Shifts**

   ```
   /shifts
   ```

   Expected: List of recent shifts

5. **Test Alert** (from Status page)

   - Click "🧪 Send Test Alert" button
   - Expected: Success message with deep link
   - In production: Would send Telegram notification

6. **Cancel Order**
   ```
   /cancel_order
   ```
   Expected: Cancellation confirmation

### API Testing (curl)

```bash
# Health check
curl https://octaneshift-api-1.onrender.com/health

# Get presets
curl https://octaneshift-api-1.onrender.com/api/presets

# Get quote
curl "https://octaneshift-api-1.onrender.com/api/pair?from=usdt-ethereum&to=eth-base&amount=10"

# Create shift
curl -X POST https://octaneshift-api-1.onrender.com/api/shifts/variable \
  -H "Content-Type: application/json" \
  -d '{
    "depositCoin": "USDT",
    "depositNetwork": "ethereum",
    "settleCoin": "ETH",
    "settleNetwork": "base",
    "settleAddress": "0x1641a049381149afaacef386ee58fda5ad9be32"
  }'

# Get status
curl https://octaneshift-api-1.onrender.com/api/status

# Test alert
curl -X POST https://octaneshift-api-1.onrender.com/api/test-alert
```


## 🔧 Development

### Project Structure

```
octaneshift-api/
├── src/                    # Backend source
│   ├── bot/               # Telegram bot
│   │   ├── telegram.ts   # Bot logic
│   │   ├── config.ts     # Bot configuration
│   │   ├── networkMap.ts # Chain mappings
│   │   └── uiHelpers.ts  # UI utilities
│   ├── routes/           # API routes
│   │   ├── batch.ts      # Batch top-up
│   │   ├── deeplink.ts   # Deep link validation
│   │   ├── gifts.ts      # Gift cards
│   │   ├── presets.ts    # Preset amounts
│   │   ├── proof.ts      # Transaction proof
│   │   ├── status.ts     # Status dashboard
│   │   ├── test-alert.ts # Test alert
│   │   └── ...           # Other routes
│   ├── lib/              # Core libraries
│   │   ├── sideshift.ts  # SideShift API client
│   │   ├── coinsCache.ts # Coin data caching
│   │   └── chains.ts     # Chain configurations
│   ├── middleware/       # Express middleware
│   ├── services/         # Background services
│   ├── store/            # In-memory data store
│   └── utils/            # Utilities
│
├── web/                   # Frontend source
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── Navigation.tsx
│   │   │   ├── SwapInterface.tsx
│   │   │   └── ...
│   │   ├── pages/        # Route pages
│   │   │   ├── Presets.tsx
│   │   │   ├── BatchTopUp.tsx
│   │   │   ├── GiftCreate.tsx
│   │   │   ├── Status.tsx
│   │   │   ├── Proof.tsx
│   │   │   └── ...
│   │   ├── services/     # API client
│   │   ├── config/       # Chain configs
│   │   └── App.tsx       # Main app component
│   └── public/           # Static assets
│
├── .env                   # Environment variables
├── package.json          # Backend dependencies
├── tsconfig.json         # TypeScript config
└── README.md             # This file
```

### Scripts

**Backend:**

```bash
npm run dev        # Development with hot reload
npm run build      # Build TypeScript
npm start          # Production server
npm run type-check # Check types
```

**Frontend:**

```bash
cd web
npm run dev        # Development server (port 5173)
npm run build      # Build for production
npm run preview    # Preview production build
```

### Adding New Features

1. **Backend Route**

   ```typescript
   // src/routes/my-feature.ts
   import { Router } from "express";
   const router = Router();

   router.get("/", async (req, res) => {
     res.json({ success: true, data: {} });
   });

   export default router;
   ```

2. **Register Route**

   ```typescript
   // src/index.ts
   import myFeatureRoutes from "./routes/my-feature";
   app.use("/api/my-feature", myFeatureRoutes);
   ```

3. **Frontend Page**

   ```tsx
   // web/src/pages/MyFeature.tsx
   export default function MyFeature() {
     return <div>My Feature</div>;
   }
   ```

4. **Add Route**
   ```tsx
   // web/src/App.tsx
   <Route path="/my-feature" element={<MyFeature />} />
   ```

---

## 🔐 Security Features

- **Helmet**: Security headers
- **CORS**: Restricted origins
- **Rate Limiting**: 100 req/15min (general), 10 req/15min (strict)
- **Input Validation**: Zod schemas for all inputs
- **Data Masking**: IP addresses and wallet addresses in logs
- **Webhook Secrets**: Telegram webhook validation
- **No Sensitive Data**: Private keys never stored

---

## 📊 Monitoring

### Health Endpoint

```bash
curl https://octaneshift-api-1.onrender.com/health
```

### Logs

- **Backend**: Render logs (dashboard → Logs tab)
- **Frontend**: Vercel logs (dashboard → Deployments → Logs)
- **Structured JSON**: Pino logger with masking

### Error Tracking

- Problem+JSON responses (RFC 7807)
- Request ID tracking
- Stack traces in development only

---

## 📝 License

MIT License - see LICENSE file for details.

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/mohamedwael201193/octaneshift-api/issues)
- **Email**: support@octaneshift.com
- **Telegram**: [@octaneshift_bot](https://t.me/OctaneShift_Bot)

---

## 🎯 Wave 2 Completion Checklist

- ✅ Preset quick amounts
- ✅ Batch gas top-up (50 addresses)
- ✅ Gift card system
- ✅ Deep link navigation
- ✅ Notification system
- ✅ Proof of payment
- ✅ Status dashboard with test alert
- ✅ Telegram bot integration
- ✅ Memo/tag support
- ✅ Navigation spacing
- ✅ Mobile-responsive design
- ✅ Error handling & validation
- ✅ Production deployment
- ✅ Comprehensive documentation

---

**Built with ❤️ by the OctaneShift team**
