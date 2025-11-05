import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useAppStore } from '@/store/app';
import { useLocationStore } from '@/store/location';
import LocationChip from '@/components/location/LocationChip';
import { MapPin, Clock, IndianRupee, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Home() {
  const navigate = useNavigate();
  const orders = useAppStore((state) => state.orders);
  const { startWatch, stopWatch } = useLocationStore();

  // Start location watching when component mounts
  useEffect(() => {
    startWatch();
    
    return () => {
      stopWatch();
    };
  }, [startWatch, stopWatch]);

  return (
    <AppShell>
      <div className="space-y-6 py-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1 rounded-full">
              <MapPin className="h-3 w-3" />
              Live near you
            </Badge>
            <LocationChip />
          </div>
          
          <p className="text-sm text-muted-foreground">
            Showing orders within <span className="font-medium text-foreground">≤ 15 km</span> of your live location
          </p>
          
          <div className="flex items-center justify-between">
            <Badge className="gap-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
              ≤ 15 km
            </Badge>
            
            <Button variant="ghost" size="sm" className="gap-2 rounded-xl">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Available Orders</h2>
          
          {orders.map((order, index) => (
            <AnimatedCard
              key={order.id}
              delay={index * 0.05}
              onClick={() => navigate(`/order/${order.id}`)}
              className="rounded-2xl border-2 hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{order.id}</h3>
                      <StatusPill status={order.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {order.etaMin} min
                      </div>
                      <DistanceBadge distance={order.distanceKm} />
                    </div>
                  </div>
                  
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 rounded-xl"
                  >
                    <IndianRupee className="h-4 w-4 text-green-700" />
                    <span className="font-bold text-green-700">{order.payout}</span>
                  </motion.div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="font-medium">Pickup</p>
                      <p className="text-muted-foreground">{order.pickup}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">Drop</p>
                      <p className="text-muted-foreground">{order.drop}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </AnimatedCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
