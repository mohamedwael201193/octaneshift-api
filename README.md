# 🚀 OctaneShift - Never Land Without Gas

**The complete gas token platform for Web3 - Get native tokens + your swap in ONE transaction.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue)](https://octaneshift.vercel.app)
[![API](https://img.shields.io/badge/API-Live-green)](https://octaneshift-api-1.onrender.com)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue)](https://t.me/OctaneShift_Bot)

---

## 🎯 The Problem We Solve

Every Web3 user has experienced this: You swap tokens to a new chain and land with **zero gas**. Your tokens are stuck. You can't do anything.

**OctaneShift solves this with Gas-on-Arrival** - receive your swapped tokens AND native gas in a single transaction.

---

## ✨ Key Features

### 🔥 Gas-on-Arrival (UNIQUE!)

Swap any token and automatically receive native gas on the destination chain. Never land without gas again.

- Creates TWO real SideShift shifts in one flow
- Main swap + gas delivery
- Perfect for cross-chain onboarding

### ⚡ Instant Gas Top-Ups

Get gas tokens on 40+ chains in under 30 seconds:

- Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche
- 200+ supported tokens via SideShift API
- Fixed and variable rate options

### 📊 Live Gas Oracle

Real-time gas prices across all supported chains:

- Smart presets: Light / Recommended / Heavy
- USD value estimates
- Automatic recommendation based on current gas prices

### 💎 Loyalty Program

Earn rewards for using OctaneShift:

- **Bronze → Silver → Gold → Platinum** tiers
- Free top-ups for loyal users
- Streak bonuses for consecutive days
- Volume-based tier upgrades

### 👥 Batch Top-Ups

Refill multiple wallets in one operation:

- CSV upload (up to 50 addresses)
- Multi-chain support with chain icons
- Per-recipient status tracking
- Real-time progress updates

### 🎁 Gas Gifts

Send gas tokens to friends via shareable links:

- Create gift links with custom amounts
- Recipients claim without wallet connection
- Perfect for onboarding new users
- 7-day expiration

### 🔐 Wallet Authentication

Secure wallet-based authentication:

- Sign message to authenticate
- Persistent referral codes
- Personal transaction history
- Referral rewards system

### 🤖 Telegram Bot

Full-featured bot for mobile users:

- `/start` - Get started
- `/swap` - Quick swap interface
- `/gas` - View gas prices
- Inline keyboards for easy navigation

### 📜 Proof of Payment

SideShift-style order page with:

- QR codes for deposit addresses
- 3-step progress indicator
- Real-time status updates
- Explorer links for all transactions

---

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Frontend      │◄────►│   Backend API    │◄────►│   SideShift API │
│   (Vercel)      │      │   (Render)       │      │   (External)    │
│                 │      │                  │      │                 │
│  React + Vite   │      │  Express + TS    │      │  200+ Tokens    │
│  TailwindCSS    │      │  Zod Validation  │      │  40+ Chains     │
│  Framer Motion  │      │  Rate Limiting   │      │  Real Shifts    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
         │                        │
         │                        ▼
         │               ┌──────────────────┐
         │               │  Telegram Bot    │
         │               │  @OctaneShift_Bot│
         │               └──────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────────────┐
│              SideShift API v2                   │
│  • Variable shifts (any amount)                 │
│  • 200+ tokens across 40+ chains               │
│  • Real-time status tracking                   │
│  • Affiliate commission                        │
└─────────────────────────────────────────────────┘
```

---

## 🔗 Live Links

| Resource        | URL                                                  |
| --------------- | ---------------------------------------------------- |
| 🌐 **Web App**  | https://octaneshift.vercel.app                       |
| 🖥️ **API**      | https://octaneshift-api-1.onrender.com               |
| 🤖 **Telegram** | https://t.me/OctaneShift_Bot                         |
| 📦 **GitHub**   | https://github.com/mohamedwael201193/octaneshift-api |

---

## 🛠️ Technology Stack

### Backend

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Validation**: Zod schemas
- **HTTP Client**: Undici
- **Logging**: Pino (structured JSON)
- **Security**: Helmet, CORS, Rate Limiting

### Frontend

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Animations**: Framer Motion
- **State**: TanStack Query
- **QR Codes**: qrcode library

### Infrastructure

- **Backend**: Render (Node.js)
- **Frontend**: Vercel (Static)
- **Bot**: Telegram Bot API (Webhooks)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- SideShift Affiliate ID & Secret

### Backend Setup

```bash
# Clone repository
git clone https://github.com/mohamedwael201193/octaneshift-api.git
cd octaneshift-api

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Build and start
npm run build
npm start
```

### Frontend Setup

```bash
cd web
npm install
npm run dev
```

### Environment Variables

```env
# Backend (.env)
PORT=3000
NODE_ENV=production
SIDESHIFT_SECRET=your_sideshift_secret
AFFILIATE_ID=your_affiliate_id
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
ADMIN_CHAT_ID=your_admin_chat_id
FRONTEND_URL=https://octaneshift.vercel.app
ALLOWED_ORIGINS=https://octaneshift.vercel.app

# Frontend (web/.env)
VITE_API_URL=https://octaneshift-api-1.onrender.com
```

---

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint               | Description           |
| ------ | ---------------------- | --------------------- |
| GET    | `/api/coins`           | List supported coins  |
| GET    | `/api/pair`            | Get pair info & rates |
| POST   | `/api/shifts/variable` | Create variable shift |
| GET    | `/api/shifts/:id`      | Get shift status      |
| GET    | `/api/permissions`     | Check geo-permissions |

### Gas-on-Arrival

| Method | Endpoint                     | Description              |
| ------ | ---------------------------- | ------------------------ |
| POST   | `/api/gas-on-arrival/quote`  | Get combined quote       |
| POST   | `/api/gas-on-arrival/create` | Create swap + gas shifts |

### Batch Operations

| Method | Endpoint           | Description      |
| ------ | ------------------ | ---------------- |
| POST   | `/api/batch/topup` | Batch gas top-up |

### Loyalty System

| Method | Endpoint             | Description            |
| ------ | -------------------- | ---------------------- |
| GET    | `/api/loyalty/stats` | Get user loyalty stats |
| GET    | `/api/loyalty/tiers` | Get tier information   |

### Gas Oracle

| Method | Endpoint                  | Description        |
| ------ | ------------------------- | ------------------ |
| GET    | `/api/gas/prices`         | Get all gas prices |
| GET    | `/api/gas/presets/:chain` | Get smart presets  |

### Wallet Auth

| Method | Endpoint           | Description           |
| ------ | ------------------ | --------------------- |
| POST   | `/api/auth/nonce`  | Get nonce for signing |
| POST   | `/api/auth/verify` | Verify signature      |
| GET    | `/api/auth/me`     | Get user info         |

---

## 🔐 Security Features

- **x-user-ip Header**: Proper IP forwarding for SideShift compliance
- **Rate Limiting**: Per-endpoint rate limits
- **CORS**: Strict origin validation
- **Helmet**: Security headers
- **Input Validation**: Zod schemas on all endpoints
- **Non-Custodial**: Users control their own funds
- **Server-only Secrets**: x-sideshift-secret never exposed to client

---

## 📊 SideShift API Integration

OctaneShift uses **SideShift API v2** directly (not the widget):

### Endpoints Used

- `GET /v2/coins` - Supported assets
- `GET /v2/pair/:from/:to` - Pair info
- `POST /v2/shifts/variable` - Variable shifts
- `GET /v2/shifts/:id` - Status tracking
- `GET /v2/permissions` - Geo-checking

### Best Practices

- ✅ x-user-ip header for compliance
- ✅ x-sideshift-secret on server only
- ✅ Affiliate ID on all shifts
- ✅ Proper error handling
- ✅ Rate limiting to prevent abuse

---

## 🚀 Deployment

### Render (Backend)

1. Create new Web Service
2. Connect GitHub repository
3. Set environment variables
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`

### Vercel (Frontend)

1. Import from GitHub
2. Root Directory: `web`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Set VITE_API_URL environment variable

---

## 📁 Project Structure

```
octaneshift-api/
├── src/                    # Backend source
│   ├── bot/               # Telegram bot
│   ├── routes/            # API routes
│   │   ├── auth.ts        # Wallet authentication
│   │   ├── batch.ts       # Batch top-up
│   │   ├── gasOnArrival.ts # Gas-on-Arrival
│   │   ├── loyalty.ts     # Loyalty system
│   │   ├── shifts.ts      # SideShift integration
│   │   └── ...
│   ├── lib/               # Core libraries
│   │   ├── sideshift.ts   # SideShift API client
│   │   └── chains.ts      # Chain configurations
│   ├── middleware/        # Express middleware
│   ├── services/          # Background services
│   │   ├── gasOracle.ts   # Live gas prices
│   │   └── loyalty.ts     # Loyalty tracking
│   └── store/             # Data persistence
│
├── web/                    # Frontend source
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Route pages
│   │   ├── services/      # API client
│   │   └── hooks/         # Custom hooks
│   └── public/            # Static assets
│
├── data/                   # Persistent data
│   └── store.json         # User data store
│
├── .env                    # Environment variables
├── package.json           # Backend dependencies
├── render.yaml            # Render deployment config
└── README.md              # This file
```

---

## 🏆 Wave 3 Highlights

| Feature          | Status | Description            |
| ---------------- | ------ | ---------------------- |
| Gas-on-Arrival   | ✅     | Swap + gas in one flow |
| Live Gas Oracle  | ✅     | Real-time prices       |
| Loyalty Program  | ✅     | Tiers & rewards        |
| Wallet Auth      | ✅     | Secure sessions        |
| Referral System  | ✅     | Earn from referrals    |
| Batch with Icons | ✅     | Visual chain selector  |
| Proof Page       | ✅     | SideShift-style UI     |
| QR Codes         | ✅     | Scannable addresses    |

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 🙏 Acknowledgments

- **SideShift.ai** - For the amazing API
- **SideShift WaveHack** - For the buildathon opportunity

---

**Built with ❤️ for the SideShift WaveHack Wave 3**

_Never land without gas. Use OctaneShift._
