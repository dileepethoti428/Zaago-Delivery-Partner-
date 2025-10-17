import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Zap } from "lucide-react";
import zaagoLogo from "@/assets/zaago-logo.webp";

const Splash = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 1500); // Reduced from 3000ms to 1500ms

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-dark relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 bg-neon/5 blur-3xl" />
      
      {/* Logo Animation */}
      <div className="flex items-center justify-center animate-bounce-in">
        <div className="relative">
          <img 
            src={zaagoLogo} 
            alt="Zaago Logo" 
            className="w-24 h-24 animate-glow-pulse"
            decoding="async"
          />
        </div>
      </div>
      
      {/* Brand Name */}
      <h1 className="text-4xl font-bold text-foreground mt-6 animate-fade-in">
        Zaago
      </h1>
      <p className="text-lg text-muted-foreground mt-2 animate-fade-in">
        Delivery Agent
      </p>
      
      {/* Loading indicator */}
      <div className="mt-12 w-32 h-1 bg-muted rounded-full overflow-hidden animate-slide-up">
        <div className="h-full bg-gradient-neon animate-pulse" />
      </div>
      
      <p className="text-sm text-muted-foreground mt-4 animate-fade-in">
        Loading your dashboard...
      </p>
    </div>
  );
};

export default Splash;