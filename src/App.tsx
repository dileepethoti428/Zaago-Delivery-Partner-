import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import RequireAuth from "@/components/RequireAuth";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useAudioNotification, RingtoneSettings } from "@/hooks/useAudioNotification";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

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
  const [agentSettings, setAgentSettings] = useState<RingtoneSettings>({
    enabled: true,
    volume: 0.8,
    type: 'iphone-6-ringtone',
    frequency: 'double',
  });
  const [audioInitialized, setAudioInitialized] = useState(() => {
    return localStorage.getItem('audio_initialized') === 'true';
  });
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);

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

  // Show audio initialization prompt if not initialized
  useEffect(() => {
    if (!audioInitialized && hasPermission) {
      setShowAudioPrompt(true);
    }
  }, [audioInitialized, hasPermission]);

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

  const handleEnableAudio = () => {
    // User interaction to initialize audio
    const audio = new Audio('/notification-sound.mp3');
    audio.volume = 0.1;
    audio.play().then(() => {
      console.log('✅ Audio initialized with user interaction');
      localStorage.setItem('audio_initialized', 'true');
      setAudioInitialized(true);
      setShowAudioPrompt(false);
    }).catch(error => {
      console.error('❌ Failed to initialize audio:', error);
    });
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background relative">
        {/* Audio Initialization Prompt */}
        {showAudioPrompt && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-sm p-4 shadow-lg">
            <div className="max-w-md mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Bell className="w-6 h-6 text-primary-foreground" />
                <div>
                  <p className="text-sm font-semibold text-primary-foreground">Enable Notification Sounds</p>
                  <p className="text-xs text-primary-foreground/80">Tap to hear order alerts even when app is closed</p>
                </div>
              </div>
              <Button 
                onClick={handleEnableAudio}
                size="sm"
                variant="secondary"
                className="shrink-0"
              >
                Enable
              </Button>
            </div>
          </div>
        )}
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
