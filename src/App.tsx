import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";

// Import all pages
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import Home from "./pages/Home";
import OrderDetails from "./pages/OrderDetails";
import Tracking from "./pages/Tracking";
import Profile from "./pages/Profile";
import Earnings from "./pages/Earnings";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            <Route path="/home" element={<Home />} />
            <Route path="/order-details" element={<OrderDetails />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/earnings" element={<Earnings />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            
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
  </QueryClientProvider>
);

export default App;
