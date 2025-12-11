/**
 * CoinIcon Component - Display cryptocurrency icons from SideShift API
 * Wave 3 Feature: Proper coin icons throughout the UI
 */

import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://octaneshift-api-1.onrender.com";

interface CoinIconProps {
  apiCode?: string; // e.g., "eth-ethereum", "pol-polygon"
  coin?: string; // deprecated: use apiCode instead
  network?: string; // deprecated: use apiCode instead
  size?: number;
  className?: string;
  showFallback?: boolean;
}

/**
 * Get icon URL for a coin
 * Uses the backend icons API which caches icons from SideShift
 */
function getIconUrl(apiCode?: string, coin?: string, network?: string): string {
  if (apiCode) {
    return `${API_BASE}/api/icons/${apiCode}`;
  }
  // Fallback for legacy coin+network format
  const coinLower = coin?.toLowerCase() || "unknown";
  const networkLower = network?.toLowerCase() || coinLower;
  return `${API_BASE}/api/icons/${coinLower}-${networkLower}`;
}

/**
 * Fallback SVG when icon fails to load
 */
function FallbackIcon({ coin, size }: { coin: string; size: number }) {
  const firstLetter = coin.charAt(0).toUpperCase();
  const fontSize = Math.max(10, size * 0.5);

  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-gray-600 to-gray-700"
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-white" style={{ fontSize }}>
        {firstLetter}
      </span>
    </div>
  );
}

export default function CoinIcon({
  apiCode,
  coin,
  network,
  size = 24,
  className = "",
  showFallback = true,
}: CoinIconProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const displayName = apiCode?.split("-")[0] || coin || "coin";

  if (hasError && showFallback) {
    return <FallbackIcon coin={displayName} size={size} />;
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {isLoading && (
        <div
          className="absolute inset-0 rounded-full bg-gray-700 animate-pulse"
          style={{ width: size, height: size }}
        />
      )}
      <img
        src={getIconUrl(apiCode, coin, network)}
        alt={`${displayName} icon`}
        width={size}
        height={size}
        className={`rounded-full ${
          isLoading ? "opacity-0" : "opacity-100"
        } transition-opacity`}
        onLoad={() => setIsLoading(false)}
        onError={(e) => {
          console.error(
            `Icon load error for ${apiCode || `${coin}-${network}`}:`,
            e
          );
          console.log("Icon URL:", getIconUrl(apiCode, coin, network));
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}

/**
 * Coin icon with label
 */
export function CoinIconWithLabel({
  coin,
  network,
  apiCode,
  label,
  size = 24,
  className = "",
}: CoinIconProps & { label?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <CoinIcon coin={coin} network={network} apiCode={apiCode} size={size} />
      <span className="font-medium">
        {label ||
          coin?.toUpperCase() ||
          apiCode?.split("-")[0]?.toUpperCase() ||
          "TOKEN"}
      </span>
    </div>
  );
}

/**
 * Dual coin icon for trading pairs
 */
export function CoinPairIcon({
  fromCoin,
  fromNetwork,
  toCoin,
  toNetwork,
  size = 24,
}: {
  fromCoin: string;
  fromNetwork?: string;
  toCoin: string;
  toNetwork?: string;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center">
      <CoinIcon coin={fromCoin} network={fromNetwork} size={size} />
      <div
        className="relative -ml-2 border-2 border-gray-800 rounded-full"
        style={{ width: size + 4, height: size + 4 }}
      >
        <CoinIcon coin={toCoin} network={toNetwork} size={size} />
      </div>
    </div>
  );
}

/**
 * Coin icon for use in select dropdowns
 */
export function CoinSelectOption({
  coin,
  network,
  name,
}: {
  coin: string;
  network?: string;
  name?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <CoinIcon coin={coin} network={network} size={24} />
      <div>
        <span className="font-medium">{coin.toUpperCase()}</span>
        {name && <span className="text-gray-400 text-sm ml-2">{name}</span>}
      </div>
      {network && network !== coin && (
        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded ml-auto">
          {network}
        </span>
      )}
    </div>
  );
}

/**
 * Stack of coin icons (for showing multiple coins)
 */
export function CoinIconStack({
  coins,
  size = 24,
  maxShow = 4,
}: {
  coins: Array<{ coin: string; network?: string }>;
  size?: number;
  maxShow?: number;
}) {
  const visibleCoins = coins.slice(0, maxShow);
  const extraCount = coins.length - maxShow;

  return (
    <div className="inline-flex items-center">
      {visibleCoins.map((c, index) => (
        <div
          key={`${c.coin}-${c.network}-${index}`}
          className="relative border-2 border-gray-800 rounded-full"
          style={{
            marginLeft: index > 0 ? -size * 0.3 : 0,
            zIndex: visibleCoins.length - index,
          }}
        >
          <CoinIcon coin={c.coin} network={c.network} size={size} />
        </div>
      ))}
      {extraCount > 0 && (
        <div
          className="flex items-center justify-center rounded-full bg-gray-700 text-xs font-medium text-white border-2 border-gray-800"
          style={{
            width: size,
            height: size,
            marginLeft: -size * 0.3,
          }}
        >
          +{extraCount}
        </div>
      )}
    </div>
  );
}
