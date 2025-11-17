import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { Clock, IndianRupee, RefreshCw, PackageX, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrders, useAcceptOrder, useRejectOrder } from '@/hooks/useOrders';
import { useLocationStore } from '@/store/location';
import { useAuthStore } from '@/store/auth';
import { useProfile } from '@/hooks/useProfile';
import { getDistanceKm } from '@/utils/geo';
import { toast } from '@/hooks/use-toast';
import LocationChip from '@/components/location/LocationChip';
import type { GeoPoint } from '@/utils/coords';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { formatDistanceToNow } from 'date-fns';
import { startOrdersRealtime, stopOrdersRealtime } from '@/store/orders';

const RADIUS_KM = 15;

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: profile } = useProfile(user?.email);
  const { data: orders = [], isLoading: loading, error, refetch } = useOrders(profile?.id);
  const acceptOrderMutation = useAcceptOrder();
  const rejectOrderMutation = useRejectOrder();
  
  const lastKnown = useLocationStore((state) => state.lastKnown);
  const permission = useLocationStore((state) => state.permission);
  const startWatch = useLocationStore((state) => state.startWatch);
  const stopWatch = useLocationStore((state) => state.stopWatch);

  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'newest' | 'oldest'>('distance');

  // Split orders into nearby (within 15km) and all others
  const { nearbyOrders, otherOrders } = useMemo(() => {
    if (!lastKnown) return { nearbyOrders: [], otherOrders: orders };

    const nearby: Array<typeof orders[0] & { distanceKm: number }> = [];
    const others: typeof orders = [];

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
        } else {
          others.push(order);
        }
      } else {
        others.push(order);
      }
    });

    // Sort nearby based on selected sort option
    nearby.sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (sortBy === 'oldest') return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      return a.distanceKm - b.distanceKm; // default distance
    });

    // Sort others by newest/oldest if selected, otherwise by creation time
    others.sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (sortBy === 'oldest') return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      return (b.createdAt ?? 0) - (a.createdAt ?? 0); // default newest
    });

    return { nearbyOrders: nearby, otherOrders: others };
  }, [orders, lastKnown, sortBy]);

  useEffect(() => {
    startWatch();
    startOrdersRealtime();
    
    return () => {
      stopWatch();
      stopOrdersRealtime();
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleAccept = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User profile not found',
      });
      return;
    }

    setProcessingOrder(orderId);
    try {
      await acceptOrderMutation.mutateAsync({ orderId, agentId: profile.id });
    } catch (error: any) {
      // Error handled by mutation
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleReject = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!profile?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User profile not found',
      });
      return;
    }
    
    setProcessingOrder(orderId);
    try {
      await rejectOrderMutation.mutateAsync({ orderId, agentId: profile.id });
    } catch (error: any) {
      // Error handled by mutation
    } finally {
      setProcessingOrder(null);
    }
  };

  const handleManageDelivery = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/manage-delivery/${orderId}`);
  };

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
          
          {error && (
            <Card className="rounded-2xl border-2 border-destructive/50">
              <CardContent className="p-6 space-y-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Failed to Load Orders</p>
                  <p className="text-sm text-muted-foreground mt-1">{error?.message || 'Unknown error'}</p>
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

          {/* Empty State - No Orders */}
          {!error && !loading && lastKnown && nearbyOrders.length === 0 && otherOrders.length === 0 && (
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
            <PullToRefresh onRefresh={handleRefresh} pullingContent="" refreshingContent={<div className="text-center py-4 text-muted-foreground">Refreshing...</div>}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-muted-foreground">Nearby Orders</h3>
                    <DistanceBadge radiusKm={RADIUS_KM} />
                  </div>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="h-8 w-[130px] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distance">Distance</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {nearbyOrders.map((order, index) => (
                  <AnimatedCard
                    key={order.id}
                    delay={index * 0.05}
                    onClick={() => {
                      if (order.status === 'packed' || order.status === 'assigned') return;
                      navigate(`/order/${order.id}`);
                    }}
                    className="rounded-2xl border-2 hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{order.customerName || order.id}</h3>
                            <StatusPill status={order.status} />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {order.etaMin} min
                            </div>
                            <DistanceBadge distance={order.distanceKm} />
                            {order.createdAt && (
                              <span className="text-xs">
                                {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                              </span>
                            )}
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

                      {/* Action Buttons for Packed Orders */}
                      {order.status === 'packed' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={(e) => handleAccept(order.id, e)}
                            disabled={processingOrder === order.id}
                            className="flex-1 rounded-xl gap-2"
                            size="sm"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            onClick={(e) => handleReject(order.id, e)}
                            disabled={processingOrder === order.id}
                            variant="destructive"
                            className="flex-1 rounded-xl gap-2"
                            size="sm"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}

                      {/* Manage Delivery Button for Assigned Orders */}
                      {order.status === 'assigned' && (
                        <Button
                          onClick={(e) => handleManageDelivery(order.id, e)}
                          className="w-full rounded-xl gap-2"
                          size="sm"
                        >
                          Manage Delivery
                        </Button>
                      )}
                    </CardContent>
                  </AnimatedCard>
                ))}
              </div>
            </PullToRefresh>
          )}

          {/* Other Orders (Unknown Location or Outside Radius) */}
          {!error && !loading && lastKnown && otherOrders.length > 0 && (
            <div className="space-y-3 mt-6">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-muted-foreground">Other Orders</h3>
              </div>
              {otherOrders.map((order, index) => (
                <AnimatedCard
                  key={order.id}
                  delay={(nearbyOrders.length + index) * 0.05}
                  onClick={() => {
                    if (order.status === 'packed' || order.status === 'assigned') return;
                    navigate(`/order/${order.id}`);
                  }}
                  className="rounded-2xl border-2 hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{order.customerName || order.id}</h3>
                          <StatusPill status={order.status} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {order.etaMin} min
                          </div>
                          {order.createdAt && (
                            <span className="text-xs">
                              {formatDistanceToNow(order.createdAt, { addSuffix: true })}
                            </span>
                          )}
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

                    {/* Action Buttons for Packed Orders */}
                    {order.status === 'packed' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={(e) => handleAccept(order.id, e)}
                          disabled={processingOrder === order.id}
                          className="flex-1 rounded-xl gap-2"
                          size="sm"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          onClick={(e) => handleReject(order.id, e)}
                          disabled={processingOrder === order.id}
                          variant="destructive"
                          className="flex-1 rounded-xl gap-2"
                          size="sm"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {/* Manage Delivery Button for Assigned Orders */}
                    {order.status === 'assigned' && (
                      <Button
                        onClick={(e) => handleManageDelivery(order.id, e)}
                        className="w-full rounded-xl gap-2"
                        size="sm"
                      >
                        Manage Delivery
                      </Button>
                    )}
                  </CardContent>
                </AnimatedCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
    </motion.div>
  );
}
