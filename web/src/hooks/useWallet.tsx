import { BrowserProvider, Eip1193Provider } from "ethers";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import octaneAPI from "../services/api";

// Extend window for ethereum
declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean;
      on?: (event: string, callback: (...args: any[]) => void) => void;
      removeListener?: (
        event: string,
        callback: (...args: any[]) => void
      ) => void;
    };
  }
}

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  referralCode: string | null;
  isLoading: boolean;
  error: string | null;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  signIn: (referralCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

const WALLET_ADDRESS_KEY = "octaneshift_wallet_address";
const WALLET_AUTH_KEY = "octaneshift_wallet_auth";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isAuthenticated: false,
    referralCode: null,
    isLoading: true,
    error: null,
  });

  // Initialize from localStorage
  useEffect(() => {
    const savedAddress = localStorage.getItem(WALLET_ADDRESS_KEY);
    const savedAuth = localStorage.getItem(WALLET_AUTH_KEY);

    if (savedAddress && savedAuth === "true") {
      // Verify the auth is still valid
      checkAuthStatus(savedAddress);
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }

    // Listen for account changes
    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("disconnect", handleDisconnect);
    }

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("disconnect", handleDisconnect);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect();
    } else if (accounts[0].toLowerCase() !== state.address?.toLowerCase()) {
      // Account changed, need to re-authenticate
      disconnect();
      setState((s) => ({
        ...s,
        address: accounts[0].toLowerCase(),
        isConnected: true,
        isAuthenticated: false,
      }));
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const checkAuthStatus = async (address: string) => {
    try {
      const response = await octaneAPI.authCheckStatus(address);
      if (response.isAuthenticated) {
        // Get user info
        const userResponse = await octaneAPI.authGetMe(address);
        setState({
          address,
          isConnected: true,
          isAuthenticated: true,
          referralCode: userResponse.referralCode,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          address,
          isConnected: true,
          isAuthenticated: false,
          referralCode: null,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      localStorage.removeItem(WALLET_ADDRESS_KEY);
      localStorage.removeItem(WALLET_AUTH_KEY);
      setState({
        address: null,
        isConnected: false,
        isAuthenticated: false,
        referralCode: null,
        isLoading: false,
        error: null,
      });
    }
  };

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState((s) => ({
        ...s,
        error: "Please install MetaMask or another Web3 wallet",
      }));
      return;
    }

    try {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const address = accounts[0].toLowerCase();
      localStorage.setItem(WALLET_ADDRESS_KEY, address);

      // Check if already authenticated
      const response = await octaneAPI.authCheckStatus(address);

      if (response.isAuthenticated) {
        localStorage.setItem(WALLET_AUTH_KEY, "true");
        const userResponse = await octaneAPI.authGetMe(address);
        setState({
          address,
          isConnected: true,
          isAuthenticated: true,
          referralCode: userResponse.referralCode,
          isLoading: false,
          error: null,
        });
      } else {
        setState({
          address,
          isConnected: true,
          isAuthenticated: false,
          referralCode: null,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      console.error("Failed to connect wallet:", error);
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error.message || "Failed to connect wallet",
      }));
    }
  }, []);

  const signIn = useCallback(
    async (referralCode?: string) => {
      if (!state.address || !window.ethereum) {
        throw new Error("Wallet not connected");
      }

      try {
        setState((s) => ({ ...s, isLoading: true, error: null }));

        // Get nonce
        const nonceResponse = await octaneAPI.authGetNonce(state.address);

        const { nonce } = nonceResponse;

        // Sign message
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(nonce);

        // Verify signature
        const verifyResponse = await octaneAPI.authVerify({
          walletAddress: state.address,
          signature,
          referralCode: referralCode || getRefCodeFromUrl(),
        });

        localStorage.setItem(WALLET_AUTH_KEY, "true");

        setState((s) => ({
          ...s,
          isAuthenticated: true,
          referralCode: verifyResponse.referralCode,
          isLoading: false,
          error: null,
        }));

        return verifyResponse;
      } catch (error: any) {
        console.error("Failed to sign in:", error);
        setState((s) => ({
          ...s,
          isLoading: false,
          error: error.message || "Failed to sign in",
        }));
        throw error;
      }
    },
    [state.address]
  );

  const signOut = useCallback(async () => {
    if (!state.address) return;

    try {
      await octaneAPI.authLogout(state.address);
    } catch (error) {
      console.error("Logout API failed:", error);
    }

    localStorage.removeItem(WALLET_AUTH_KEY);
    setState((s) => ({
      ...s,
      isAuthenticated: false,
      referralCode: null,
    }));
  }, [state.address]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    localStorage.removeItem(WALLET_AUTH_KEY);
    setState({
      address: null,
      isConnected: false,
      isAuthenticated: false,
      referralCode: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        signIn,
        signOut,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

// Helper to get referral code from URL
function getRefCodeFromUrl(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  return params.get("ref") || undefined;
}

// Export helper to format address
export function formatAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(38)}`;
}
