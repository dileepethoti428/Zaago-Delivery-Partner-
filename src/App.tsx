import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import BottomNavigation from "@/components/BottomNavigation";
import RequireAuth from "@/components/RequireAuth";
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

function AppContent() {
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
}

function App() {
  return (
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
}

export default App;
