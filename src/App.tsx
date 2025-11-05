import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, lazy, Suspense } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import RequireAuth from "@/components/RequireAuth";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useAudioNotification, RingtoneSettings } from "@/hooks/useAudioNotification";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { OneSignalInit } from "@/components/OneSignalInit";

// Import critical pages (loaded immediately)
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Home from "./pages/Home";
import PendingApproval from "./pages/PendingApproval";

// Lazy load non-critical pages (loaded on demand)
const MyDeliveries = lazy(() => import("./pages/MyDeliveries"));
const History = lazy(() => import("./pages/History"));
const Tracking = lazy(() => import("./pages/Tracking"));
const DeliveryDetails = lazy(() => import("./pages/DeliveryDetails"));
const Profile = lazy(() => import("./pages/Profile"));
const Earnings = lazy(() => import("./pages/Earnings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const PrivacySecurity = lazy(() => import("./pages/PrivacySecurity"));
const Help = lazy(() => import("./pages/Help"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));

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
  const [agentSettings, setAgentSettings] = useState<RingtoneSettings>({
    enabled: true,
    volume: 0.8,
    type: 'iphone-6-ringtone',
    frequency: 'double',
  });

  const { playNotificationSound } = useAudioNotification(agentSettings);

  // Load agent settings from database
  useEffect(() => {
    const loadAgentSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: agent } = await supabase
          .from('delivery_agents')
          .select('id')
          .eq('email', user.email)
          .eq('is_active', true)
          .single();

        if (!agent) return;

        const { data: settings } = await supabase
          .from('agent_settings')
          .select('*')
          .eq('agent_id', agent.id)
          .single();

        if (settings) {
          setAgentSettings({
            enabled: settings.ringtone_enabled ?? true,
            volume: settings.ringtone_volume ?? 0.8,
            type: settings.ringtone_type ?? 'iphone-6-ringtone',
            frequency: settings.notification_frequency ?? 'double',
          });
          console.log('✅ Loaded agent audio settings:', settings);
        }
      } catch (error) {
        console.error('❌ Error loading agent settings:', error);
      }
    };

    loadAgentSettings();
  }, []);


  // Request notification permission on first load
  useEffect(() => {
    if (!hasPermission) {
      const timer = setTimeout(() => {
        requestPermission();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasPermission, requestPermission]);

  // Listen for service worker messages to play audio
  useEffect(() => {
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
      <Toaster />
      <Sonner />
      <OneSignalInit />
      <div className="min-h-screen bg-background relative">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <Routes>
            {/* Splash and Authentication */}
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            
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
        </Suspense>
        
        {/* Bottom Navigation */}
        <BottomNavigation />
        
        {/* Bottom padding for navigation */}
        <div className="pb-20" />
      </div>
    </BrowserRouter>
  );
};

const App = () => (
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem
    disableTransitionOnChange={false}
  >
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
