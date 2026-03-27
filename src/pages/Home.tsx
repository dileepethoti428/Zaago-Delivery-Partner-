import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { Clock, IndianRupee, RefreshCw, PackageX, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { OrderCard } from '@/components/order/OrderCard';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrders, useAcceptOrder, useRejectOrder } from '@/hooks/useOrders';
import { useOrdersRealtimeInvalidate } from '@/hooks/useOrdersRealtimeInvalidate';
import { useLocationStore } from '@/store/location';
import { useAuthStore } from '@/store/auth';
import { useProfile } from '@/hooks/useProfile';
import { useScreenLocationSync } from '@/hooks/useScreenLocationSync';
import { getDistanceKm } from '@/utils/geo';
import { toast } from '@/hooks/use-toast';
import LocationChip from '@/components/location/LocationChip';
import type { GeoPoint } from '@/utils/coords';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { formatDistanceToNow } from 'date-fns';

const RADIUS_KM = 15;

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.email);
  const { data: orders = [], isLoading: loading, error, refetch } = useOrders(profile?.agent_id, true);
  const acceptOrderMutation = useAcceptOrder();
  const rejectOrderMutation = useRejectOrder();
  
  // Start location sync on this screen
  useScreenLocationSync();

  const lastKnown = useLocationStore((state) => state.lastKnown);
  const permission = useLocationStore((state) => state.permission);

  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'newest' | 'oldest'>('distance');

  // Stable location key — prevents distance recalc on every minor GPS tick
  const locationKey = lastKnown ? `${lastKnown.lat.toFixed(4)}-${lastKnown.lng.toFixed(4)}` : 'none';

  const ordersWithDistance = useMemo(() => {
    // Safety filter: exclude terminal statuses client-side as well
    const terminalStatuses = ['delivered', 'completed', 'cancelled', 'canceled'];
    const activeOrders = orders.filter(order => 
      !terminalStatuses.includes(order.status?.toLowerCase() ?? '')
    );
    
    if (!lastKnown) return activeOrders.map(order => ({ order, distanceKm: null }));
    
    return activeOrders.map(order => {
      if (!order.pickupCoord) {
        return { order, distanceKm: null };
      }
      
      const distanceKm = Number(
        getDistanceKm(
          { lat: lastKnown.lat, lng: lastKnown.lng } as GeoPoint,
          order.pickupCoord as GeoPoint
        ).toFixed(2)
      );
      
      return { order, distanceKm };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, locationKey]);

  const { nearbyOrders, otherOrders } = useMemo(() => {
    const nearby: Array<typeof orders[0] & { distanceKm: number }> = [];
    const others: typeof orders = [];
    
    ordersWithDistance.forEach(({ order, distanceKm }) => {
      if (distanceKm !== null && distanceKm <= RADIUS_KM) {
        nearby.push({ ...order, distanceKm });
      } else {
        others.push(order);
      }
    });
    
    return { nearbyOrders: nearby, otherOrders: others };
  }, [ordersWithDistance]);

  const sortedNearbyOrders = useMemo(() => {
    const sorted = [...nearbyOrders];
    
    sorted.sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (sortBy === 'oldest') return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      return a.distanceKm - b.distanceKm;
    });
    
    return sorted;
  }, [nearbyOrders, sortBy]);

  const sortedOtherOrders = useMemo(() => {
    const sorted = [...otherOrders];
    
    sorted.sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (sortBy === 'oldest') return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    
    return sorted;
  }, [otherOrders, sortBy]);

  // Realtime invalidation for React Query cache
  useOrdersRealtimeInvalidate(profile?.id);

  // Location watching is handled by useScreenLocationSync above

  // Throttle guard — prevents duplicate refresh calls from pull+realtime firing together
  const refreshingRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      await useLocationStore.getState().refreshLocation();
      await refetch();
    } finally {
      refreshingRef.current = false;
    }
  }, [refetch]);

  const handleAcceptOrder = useCallback(async (orderId: string) => {
    if (!profile?.agent_id || processingOrder) return;
    setProcessingOrder(orderId);
    
    try {
      await acceptOrderMutation.mutateAsync({ orderId, agentId: profile.agent_id });
      // Instantly clear stale orders cache then navigate — no arbitrary delay needed
      navigate(`/manage-delivery/${orderId}`);
    } catch (error) {
      // Error already handled in mutation onError - don't navigate on failure
      console.log('Accept order failed, staying on Home page');
    } finally {
      setProcessingOrder(null);
    }
  }, [profile?.agent_id, processingOrder, acceptOrderMutation, navigate]);

  const handleRejectOrder = useCallback(async (orderId: string) => {
    if (!profile?.id || processingOrder) return;
    setProcessingOrder(orderId);
    
    try {
      await rejectOrderMutation.mutateAsync({ orderId, agentId: profile.id });
    } finally {
      setProcessingOrder(null);
    }
  }, [profile?.id, processingOrder, rejectOrderMutation]);

  const handleViewOrder = useCallback((orderId: string) => {
    navigate(`/order/${orderId}`);
  }, [navigate]);

  const handleManageDelivery = useCallback((orderId: string) => {
    navigate(`/manage-delivery/${orderId}`);
  }, [navigate]);

  // Show error only when fetch definitively returned null (not undefined = not yet fetched)
  if (user?.email && !profileLoading && profile === null) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md mx-4">
            <CardContent className="pt-6 space-y-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Profile Not Found</h3>
                <p className="text-sm text-muted-foreground">
                  Your delivery partner profile is not set up. Please contact support or complete your registration.
                </p>
              </div>
              <Button onClick={() => navigate('/upload-documents')} className="w-full">
                Complete Registration
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

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
                {sortedNearbyOrders.map((order, index) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    index={index}
                    isProcessing={processingOrder === order.id}
                    currentAgentId={profile?.id}
                    onAccept={handleAcceptOrder}
                    onReject={handleRejectOrder}
                    onView={handleViewOrder}
                    onManage={handleManageDelivery}
                  />
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
              {sortedOtherOrders.map((order, index) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  index={nearbyOrders.length + index}
                  isProcessing={processingOrder === order.id}
                  currentAgentId={profile?.id}
                  onAccept={handleAcceptOrder}
                  onReject={handleRejectOrder}
                  onView={handleViewOrder}
                  onManage={handleManageDelivery}
                />
                          className="w-full rounded-xl gap-2"
                          size="sm"
                        >
                          Taken
                        </Button>
                      </div>
                    ) : (order.status === 'packed' || order.status === 'accepted') ? (
                      // Order is not assigned and available for acceptance
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptOrder(order.id);
                          }}
                          disabled={processingOrder === order.id}
                          className="flex-1 rounded-xl gap-2"
                          size="sm"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectOrder(order.id);
                          }}
                          disabled={processingOrder === order.id}
                          variant="destructive"
                          className="flex-1 rounded-xl gap-2"
                          size="sm"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    ) : null}
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
