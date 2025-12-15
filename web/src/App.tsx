import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import FeaturesShowcase from "./components/FeaturesShowcase";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Navigation from "./components/Navigation";
import OrderTracker from "./components/OrderTracker";
import SupportedChains from "./components/SupportedChains";
import SwapInterface from "./components/SwapInterface";
import { WalletProvider } from "./hooks/useWallet";
import BatchTopUp from "./pages/BatchTopUp";
import DeepLink from "./pages/DeepLink";
import GasDashboard from "./pages/GasDashboard";
import GiftCreate from "./pages/GiftCreate";
import GiftReceive from "./pages/GiftReceive";
import History from "./pages/History";
import Loyalty from "./pages/Loyalty";
import Presets from "./pages/Presets";
import Proof from "./pages/Proof";
import Referrals from "./pages/Referrals";
import Simulator from "./pages/Simulator";
import Status from "./pages/Status";
import TopUp from "./pages/TopUp";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <Router>
          <Navigation />
          <div className="min-h-screen bg-black text-white pt-20">
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: "#1f2937",
                  color: "#fff",
                  border: "1px solid #374151",
                },
                success: {
                  iconTheme: {
                    primary: "#10b981",
                    secondary: "#fff",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "#ef4444",
                    secondary: "#fff",
                  },
                },
              }}
            />
            <Routes>
              {/* Main landing page */}
              <Route
                path="/"
                element={
                  <>
                    <Hero />
                    <FeaturesShowcase />
                    <HowItWorks />
                    <SupportedChains />
                    <SwapInterface />
                    <OrderTracker />
                    <Footer />
                  </>
                }
              />

              {/* Wave 2 Features */}
              <Route path="/r" element={<DeepLink />} />
              <Route path="/deeplink" element={<DeepLink />} />
              <Route path="/topup" element={<TopUp />} />
              <Route path="/status" element={<Status />} />
              <Route path="/batch" element={<BatchTopUp />} />
              <Route path="/gift/create" element={<GiftCreate />} />
              <Route path="/gift/:id" element={<GiftReceive />} />
              <Route path="/gas" element={<GasDashboard />} />
              <Route path="/dashboard" element={<GasDashboard />} />
              <Route path="/presets" element={<Presets />} />
              <Route path="/loyalty" element={<Loyalty />} />
              <Route path="/rewards" element={<Loyalty />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/history" element={<History />} />
              <Route path="/simulator" element={<Simulator />} />
              <Route path="/451" element={<Simulator />} />
              <Route path="/proof/:shiftId" element={<Proof />} />
            </Routes>
          </div>
        </Router>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
