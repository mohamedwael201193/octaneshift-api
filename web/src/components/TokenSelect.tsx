/**
 * Custom Token/Chain Selector with Coin Icons
 * Replaces native <select> to show icons in dropdown
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import CoinIcon from "./CoinIcon";

interface SelectOption {
  value: string;
  label: string;
  coin: string;
  network: string;
  apiCode?: string; // Full apiCode like "eth-ethereum" (preferred over coin+network)
  subLabel?: string;
}

interface TokenSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}

export default function TokenSelect({
  value,
  onChange,
  options,
  placeholder = "Select token",
  className = "",
  searchable = true,
}: TokenSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search
  const filteredOptions = search
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(search.toLowerCase()) ||
          opt.coin.toLowerCase().includes(search.toLowerCase()) ||
          opt.network.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Value Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-900/70 border border-gray-600 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all flex items-center justify-between hover:border-gray-500"
      >
        <div className="flex items-center gap-3">
          {selectedOption ? (
            <>
              <CoinIcon
                apiCode={
                  selectedOption.apiCode ||
                  `${selectedOption.coin}-${selectedOption.network}`
                }
                size={28}
              />
              <div className="text-left">
                <span className="font-medium">{selectedOption.label}</span>
                {selectedOption.subLabel && (
                  <span className="text-gray-400 text-sm ml-2">
                    {selectedOption.subLabel}
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <FaChevronDown
          className={`text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Search Input */}
            {searchable && (
              <div className="p-3 border-b border-gray-700">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tokens..."
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No tokens found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors text-left ${
                      option.value === value ? "bg-green-500/10" : ""
                    }`}
                  >
                    <CoinIcon
                      apiCode={
                        option.apiCode || `${option.coin}-${option.network}`
                      }
                      size={28}
                    />
                    <div className="flex-1">
                      <span className="font-medium text-white">
                        {option.label}
                      </span>
                      {option.subLabel && (
                        <span className="text-gray-400 text-sm block">
                          on {option.subLabel}
                        </span>
                      )}
                    </div>
                    {option.value === value && (
                      <span className="text-green-400 text-sm">✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Helper function to create options from DEPOSIT_TOKENS
 */
export function createDepositTokenOptions(
  depositTokens: Array<{ symbol: string; name: string; networks: string[] }>
): SelectOption[] {
  const options: SelectOption[] = [];

  for (const token of depositTokens) {
    for (const network of token.networks) {
      options.push({
        value: `${token.symbol.toLowerCase()}-${network}`,
        label: token.symbol,
        coin: token.symbol.toLowerCase(),
        network: network,
        subLabel: network.charAt(0).toUpperCase() + network.slice(1),
      });
    }
  }

  return options;
}

/**
 * Helper function to create options from SUPPORTED_CHAINS
 */
export function createChainOptions(
  supportedChains: Array<{
    id: string;
    name: string;
    symbol: string;
    apiCode: string;
  }>
): SelectOption[] {
  return supportedChains.map((chain) => {
    const [coin, network] = chain.apiCode.split("-");
    return {
      value: chain.apiCode,
      label: `${chain.symbol} on ${chain.name}`,
      coin: coin,
      network: network,
      subLabel: chain.name,
    };
  });
}
