# OctaneShift - Instant Gas Top-ups Across All Chains

A modern, animated crypto gas top-up website built with React, Vite, TypeScript, and Tailwind CSS. Features full API integration with real-time swap quotes and order tracking.

## Features

- **Animated Hero Section** with floating chain icons and live bot status
- **Interactive How It Works** section with 3D card flip animations
- **Supported Chains Grid** with real-time data for Ethereum, Base, Arbitrum, Polygon, Optimism, and Avalanche
- **Fully Functional Swap Interface** with live API quotes from SideShift.ai
- **Real-Time Order Tracker** with auto-refresh and status updates
- **Dark Theme** with neon accents and glassmorphism effects
- **Framer Motion Animations** throughout
- **React Query** for efficient data fetching and caching
- **Toast Notifications** for user feedback

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Framer Motion
- TanStack Query (React Query)
- Axios
- React Hot Toast
- React Icons

## Environment Variables

Create a `.env` file with the following variables:

```env
VITE_API_URL=https://octaneshift-api-1.onrender.com
VITE_TELEGRAM_BOT_URL=https://t.me/OctaneShift_Bot
VITE_SIDESHIFT_AFFILIATE_ID=
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Set Framework Preset to **Vite**
4. Add environment variables in Vercel dashboard
5. Deploy!

### Vercel Configuration

- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## API Integration

The website integrates with the OctaneShift API for:

- **Real-time swap quotes** - Get accurate rates before swapping
- **Order creation** - Create shifts and receive deposit addresses
- **Order tracking** - Track shift status with automatic updates
- **Bot status** - Display live bot availability

## Project Structure

```
src/
├── components/
│   ├── Hero.tsx              # Hero section with animations
│   ├── HowItWorks.tsx        # 3-step process cards
│   ├── SupportedChains.tsx   # Chain grid display
│   ├── SwapInterface.tsx     # Main swap functionality
│   ├── OrderTracker.tsx      # Order tracking interface
│   └── Footer.tsx            # Footer with links
├── config/
│   └── chains.ts             # Chain and token configurations
├── services/
│   └── api.ts                # API client and endpoints
├── App.tsx                   # Main app component
└── index.css                 # Global styles

## Key Features

### Swap Interface
- Select from multiple tokens (USDT, USDC, ETH, BTC)
- Choose destination chain
- Get real-time quotes
- Create orders with deposit addresses
- Copy addresses with one click

### Order Tracker
- Track orders by Shift ID
- Auto-refresh every 5 seconds
- Visual status indicators
- Display transaction details
- Copy deposit and destination addresses

### Animations
- Framer Motion page transitions
- Floating chain icons
- 3D card flips
- Hover effects and micro-interactions
- Smooth scroll animations
- Loading states with spinners

## Browser Support

Modern browsers with ES6+ support:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
