import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { 
  Home, 
  Package, 
  DollarSign, 
  Settings,
  Wallet,
  Truck
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import WalletDisplay from "./WalletDisplay";

const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  const tabs = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      path: "/home"
    },
    {
      id: "history",
      label: "History", 
      icon: Package,
      path: "/history"
    },
    {
      id: "earnings",
      label: "Earnings",
      icon: DollarSign,
      path: "/earnings"
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: Wallet,
      path: null // Special handling for wallet
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/settings"
    }
  ];

  const handleTabClick = (tab: any) => {
    if (tab.id === "wallet") {
      setShowWalletMenu(true);
    } else if (tab.path) {
      navigate(tab.path);
    }
  };

  // Don't show navigation on splash, login, or other excluded screens
  const excludedPaths = ["/", "/login", "/tracking"];
  const shouldShowNavigation = !excludedPaths.includes(location.pathname);

  if (!shouldShowNavigation) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = tab.path && location.pathname === tab.path;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg transition-smooth min-w-0 flex-1 ${
                  isActive 
                    ? "bg-primary/10 text-primary animate-tab-active" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <IconComponent className={`w-5 h-5 mb-1 ${isActive ? "animate-glow-pulse" : ""}`} />
                <span className="text-xs font-medium truncate">{tab.label}</span>
                
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Wallet Dialog */}
      <Dialog open={showWalletMenu} onOpenChange={setShowWalletMenu}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Wallet className="w-5 h-5" />
              <span>My Wallet</span>
            </DialogTitle>
            <DialogDescription>
              Manage your wallet balance and transactions
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <WalletDisplay />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BottomNavigation;