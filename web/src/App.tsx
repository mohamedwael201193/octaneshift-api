import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import SupportedChains from './components/SupportedChains';
import SwapInterface from './components/SwapInterface';
import OrderTracker from './components/OrderTracker';
import Footer from './components/Footer';

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
      <div className="min-h-screen bg-black text-white">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <Hero />
        <HowItWorks />
        <SupportedChains />
        <SwapInterface />
        <OrderTracker />
        <Footer />
      </div>
    </QueryClientProvider>
  );
}

export default App;
