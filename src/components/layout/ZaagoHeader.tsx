import { Truck } from 'lucide-react';

export function ZaagoHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        
        <h1 className="text-lg font-bold text-primary">Zaago Delivery Partner</h1>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </div>
    </header>
  );
}
