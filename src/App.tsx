import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import RequireAuth from "@/components/RequireAuth";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useAudioNotification } from "@/hooks/useAudioNotification";

// Import all pages
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Home from "./pages/Home";
import MyDeliveries from "./pages/MyDeliveries";
import History from "./pages/History";
import Tracking from "./pages/Tracking";
import DeliveryDetails from "./pages/DeliveryDetails";
import Profile from "./pages/Profile";
import Earnings from "./pages/Earnings";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import PrivacySecurity from "./pages/PrivacySecurity";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import SellerDashboard from "./pages/SellerDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent = () => {
  const { requestPermission, hasPermission } = useNotificationPermission();
  const { playNotificationSound } = useAudioNotification({
    enabled: true,
    volume: 1.0,
    type: 'iphone-6-ringtone',
    frequency: 'continuous',
  });

  useEffect(() => {
    // Request notification permission on first load
    if (!hasPermission) {
      // Delay request to avoid blocking initial render
      const timer = setTimeout(() => {
        requestPermission();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    // Listen for service worker messages to play audio
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_AUDIO') {
        console.log('🔊 Received audio play request from service worker');
        playNotificationSound();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [playNotificationSound]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background relative">
        <Routes>
          {/* Splash and Authentication */}
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          
          {/* Main App Routes */}
          <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/seller-dashboard" element={<RequireAuth><SellerDashboard /></RequireAuth>} />
          <Route path="/my-deliveries" element={<RequireAuth><MyDeliveries /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
          <Route path="/tracking" element={<RequireAuth><Tracking /></RequireAuth>} />
          <Route path="/delivery-details/:orderId" element={<RequireAuth><DeliveryDetails /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/earnings" element={<RequireAuth><Earnings /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/privacy-security" element={<RequireAuth><PrivacySecurity /></RequireAuth>} />
          <Route path="/help" element={<RequireAuth><Help /></RequireAuth>} />

          {/* Redirect old index route */}
          <Route path="/index" element={<Navigate to="/home" replace />} />
          
          {/* Catch-all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        
        {/* Bottom Navigation */}
        <BottomNavigation />
        
        {/* Bottom padding for navigation */}
        <div className="pb-20" />
      </div>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
