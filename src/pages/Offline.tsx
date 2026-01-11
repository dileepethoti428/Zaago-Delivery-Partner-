import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export default function Offline() {
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = () => {
    setIsChecking(true);
    // Attempt to fetch a small resource
    fetch('/favicon.ico', { cache: 'no-store' })
      .then(() => {
        // Online - reload the page
        window.location.reload();
      })
      .catch(() => {
        setIsChecking(false);
      });
  };

  useEffect(() => {
    const handleOnline = () => window.location.reload();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="w-12 h-12 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">You're Offline</h1>
          <p className="text-muted-foreground">
            No internet connection. Please check your network and try again.
          </p>
        </div>

        <Button 
          onClick={checkConnection} 
          disabled={isChecking}
          className="w-full"
        >
          {isChecking ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          We'll automatically reconnect when your internet is back.
        </p>
      </div>
    </div>
  );
}
