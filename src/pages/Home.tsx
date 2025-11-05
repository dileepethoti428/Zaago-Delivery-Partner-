import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { Clock, IndianRupee, RefreshCw, PackageX, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrdersStore, startOrdersRealtime, stopOrdersRealtime } from '@/store/orders';
import { useLocationStore } from '@/store/location';
import { getDistanceKm } from '@/utils/geo';
import LocationChip from '@/components/location/LocationChip';
import type { GeoPoint } from '@/utils/coords';

const RADIUS_KM = 15;

export default function Home() {
  const navigate = useNavigate();
  const orders = useOrdersStore((state) => state.orders);
  const loading = useOrdersStore((state) => state.loading);
  const error = useOrdersStore((state) => state.error);
  const load = useOrdersStore((state) => state.load);
  
  const lastKnown = useLocationStore((state) => state.lastKnown);
  const permission = useLocationStore((state) => state.permission);
  const startWatch = useLocationStore((state) => state.startWatch);
  const stopWatch = useLocationStore((state) => state.stopWatch);

  // Split orders into nearby (with coords) and unknown (without coords)
  const { nearbyOrders, unknownOrders } = useMemo(() => {
    if (!lastKnown) return { nearbyOrders: [], unknownOrders: [] };

    const nearby: Array<typeof orders[0] & { distanceKm: number }> = [];
    const unknown: typeof orders = [];

    orders.forEach(order => {
      if (order.pickupCoord) {
        const distanceKm = Number(
          getDistanceKm(
            { lat: lastKnown.lat, lng: lastKnown.lng } as GeoPoint,
            order.pickupCoord as GeoPoint
          ).toFixed(2)
        );
        
        if (distanceKm <= RADIUS_KM) {
          nearby.push({ ...order, distanceKm });
        }
      } else {
        unknown.push(order);
      }
    });

    // Sort nearby by distance
    nearby.sort((a, b) => a.distanceKm - b.distanceKm);

    return { nearbyOrders: nearby, unknownOrders: unknown };
  }, [orders, lastKnown]);

  // Load orders and start location watching when component mounts
  useEffect(() => {
    load();
    startWatch();
    startOrdersRealtime();
    
    return () => {
      stopWatch();
      stopOrdersRealtime();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    load();
  }, [load]);

  return (
    <motion.div initial={pageTransition.initial} animate={pageTransition.animate} exit={pageTransition.exit} transition={pageTransitionConfig} className="h-full">
      <AppShell>
        <div className="space-y-6 py-4">
        {/* Location Header */}
        <div>
          <LocationChip />
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Available Orders</h2>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2 rounded-xl"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          
          {/* Error State */}
          {error && (
            <Card className="rounded-2xl border-2 border-destructive/50">
              <CardContent className="p-6 space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Failed to Load Orders</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
                <Button 
                  variant="secondary" 
                  className="rounded-xl mt-2"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Permission Denied State */}
          {!error && (permission === 'denied' || permission === 'unsupported') && (
            <Card className="rounded-2xl border-2">
              <CardContent className="p-6 space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <PackageX className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Location Access Required</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We need your location to show nearby orders. Please enable location access in your browser settings.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading State - No Location Fix Yet or Loading Orders */}
          {!error && permission !== 'denied' && permission !== 'unsupported' && (!lastKnown || loading) && (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <p className="text-sm text-center text-muted-foreground py-4">
                {!lastKnown ? 'Getting your location...' : 'Loading orders...'}
              </p>
            </div>
          )}

          {/* Empty State - No Orders in Range */}
          {!error && !loading && lastKnown && nearbyOrders.length === 0 && unknownOrders.length === 0 && (
            <Card className="rounded-2xl border-2">
              <CardContent className="p-6 space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <PackageX className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">No Orders Available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no orders available right now. Check back soon!
                  </p>
                </div>
                <Button 
                  variant="secondary" 
                  className="rounded-xl mt-2"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Orders
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Nearby Orders List */}
          {!error && !loading && lastKnown && nearbyOrders.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-muted-foreground">Nearby Orders</h3>
                <DistanceBadge radiusKm={RADIUS_KM} />
              </div>
              {nearbyOrders.map((order, index) => (
            <AnimatedCard
              key={order.id}
              delay={index * 0.05}
              onClick={() => navigate(`/order/${order.id}`)}
              className="rounded-2xl border-2 hover:border-primary/50 transition-colors cursor-pointer"
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
            </>
          )}

          {/* Orders with Unknown Location */}
          {!error && !loading && lastKnown && unknownOrders.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6">
                <h3 className="text-base font-medium text-muted-foreground">Orders with Unknown Location</h3>
              </div>
              {unknownOrders.map((order, index) => (
            <AnimatedCard
              key={order.id}
              delay={(nearbyOrders.length + index) * 0.05}
              onClick={() => navigate(`/order/${order.id}`)}
              className="rounded-2xl border-2 hover:border-primary/50 transition-colors cursor-pointer"
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
            </>
          )}
        </div>
      </div>
    </AppShell>
    </motion.div>
  );
}
