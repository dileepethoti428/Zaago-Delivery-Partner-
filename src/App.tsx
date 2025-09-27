import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import BottomNavigation from "@/components/BottomNavigation";
import RequireAuth from "@/components/RequireAuth";

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
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
