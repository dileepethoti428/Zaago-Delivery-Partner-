import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { parseDeliverySlots } from "@/lib/deliverySlotParser";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useAgent } from "@/hooks/useAgent";
import { 
  MapPin, 
  RefreshCw,
  ChevronDown
} from "lucide-react";
import { normalizeAddress } from "@/lib/utils";
import { extractCoordinatesFromAddress, calculateRealTimeDistance } from "@/lib/distanceService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OfflineCompletionsQueue } from "@/components/OfflineCompletionsQueue";
import { OrderCard } from "@/components/OrderCard";
import { LocationPicker } from "@/components/LocationPicker";

// Get greeting based on current time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  original_address?: any;
  items: any[];
  total: number;
  status: string;
  delivery_date: string;
  delivery_time?: string;
  delivery_time_slot?: string;
  created_at: string;
  payment_status: string;
  coordinates?: { lat: number; lng: number };
  distance_km?: number;
  agent_to_shop_distance?: number;
  total_distance?: number;
  products_count?: number;
  restaurant?: string;
  backend_calculated?: boolean;
  delivery_type?: 'immediate' | 'scheduled' | 'book_now_pay_later';
  order_placed_at?: Date;
  agent_payout?: number;
  estimated_time_minutes?: number;
  subscription_id?: string;
  delivery_slots?: {
    id: string;
    slot_name: string;
    start_time: string;
    end_time: string;
  };
  pickup_location?: { lat: number; lng: number };
  pickup_address?: string;
  seller_phone?: string;
  seller_name?: string;
  eta_mins?: number;
  distance_source?: 'realtime' | 'cached' | 'fallback' | 'error';
  calculated_delivery_type?: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later';
  immediate_timing_config?: {
    max_duration_minutes: number;
    time_slot_start: string;
    time_slot_end: string;
    slot_name: string;
  };
  original_created_at?: string;
  agent_id?: string;
}

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Hooks - consolidated
  const { data: agent, isLoading: isLoadingAgent } = useAgent();
  const location = useGeolocation({
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 300000,
    saveToBackend: true,
  });
  
  const {
    orders: realtimeOrders,
    isLoading: isLoadingRealtime,
    acceptOrder: realtimeAcceptOrder,
    refreshOrders: realtimeRefresh,
  } = useRealtimeOrders(agent?.id || null);
  
  // State - simplified
  const [isOnline, setIsOnline] = useState(false);
  const [sortBy, setSortBy] = useState<'nearest' | 'newest' | 'highest'>('nearest');
  const [currentLocation, setCurrentLocation] = useState<string>('Tap to set location');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);
  const [acceptingOrders, setAcceptingOrders] = useState<Record<string, boolean>>({});
  const [rejectingOrders, setRejectingOrders] = useState<Record<string, boolean>>({});
  const [rejectedOrderIds, setRejectedOrderIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('rejectedOrderIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  
  useWakeLock(isOnline);
  
  // Calculate agent payout
  const calculateAgentPayout = useCallback((distance: number): number => {
    const baseFare = 40;
    const additionalDistance = Math.max(0, distance - 3);
    const perKmRate = 9;
    const distanceFare = additionalDistance * perKmRate;
    const subtotal = baseFare + distanceFare;
    
    const isPeakHour = () => {
      const currentHour = new Date().getHours();
      const isWeekend = [0, 6].includes(new Date().getDay());
      const isLunchRush = currentHour >= 12 && currentHour < 14;
      const isDinnerRush = currentHour >= 19 && currentHour < 22;
      return isLunchRush || isDinnerRush || isWeekend;
    };
    
    const surgeAmount = isPeakHour() ? subtotal * 0.15 : 0;
    const agentPayout = (subtotal + surgeAmount) - 13;
    
    return Math.max(12, Math.round(agentPayout * 100) / 100);
  }, []);
  
  // Transform order data
  const transformOrder = useCallback(async (order: any, isAssigned: boolean = false): Promise<Order> => {
    const originalAddress = order.address;
    const normalizedAddr = normalizeAddress(originalAddress);
    
    let pickupLocation = order.pickup_location;
    let pickupAddress = order.pickup_address;
    let sellerName = order.seller_name;
    let sellerPhone = order.seller_phone;
    
    if (isAssigned && !pickupLocation && order.items?.length > 0) {
      const sellerId = order.items[0].seller_id;
      
      if (sellerId) {
        const { data: sellerData } = await supabase
          .from('sellers')
          .select('name, phone, latitude, longitude, address, business_name')
          .eq('user_id', sellerId)
          .single();
        
        if (sellerData?.latitude && sellerData?.longitude) {
          pickupLocation = {
            lat: sellerData.latitude,
            lng: sellerData.longitude
          };
          pickupAddress = normalizeAddress(sellerData.address) || sellerData.business_name || 'Pickup Location';
          sellerName = sellerData.name || sellerData.business_name;
          sellerPhone = sellerData.phone;
        }
      }
    }
    
    return {
      id: order.id,
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      address: typeof normalizedAddr === 'string' ? normalizedAddr : 'Address processing error',
      original_address: originalAddress,
      items: Array.isArray(order.items) ? order.items : [],
      total: order.total || 0,
      status: order.status,
      delivery_date: order.delivery_date || '',
      created_at: order.created_at,
      payment_status: order.payment_status || '',
      coordinates: order.coordinates,
      distance_km: order.distance_km,
      delivery_time: order.delivery_time,
      products_count: Array.isArray(order.items) ? order.items.length : 1,
      restaurant: order.restaurant,
      backend_calculated: false,
      delivery_type: order.calculated_delivery_type || (() => {
        if (order.subscription_id) return 'scheduled';
        if (order.delivery_time_slot) return 'scheduled';
        if (order.delivery_time && order.delivery_time !== 'Immediate') return 'scheduled';
        if (order.payment_status === 'Pending' && 
            order.delivery_date && 
            order.delivery_date !== new Date().toISOString().split('T')[0]) {
          return 'book_now_pay_later';
        }
        return 'immediate';
      })(),
      order_placed_at: new Date(order.created_at),
      agent_payout: order.agent_payout,
      estimated_time_minutes: order.estimated_time_minutes,
      subscription_id: order.subscription_id,
      delivery_slots: parseDeliverySlots(order),
      pickup_location: pickupLocation,
      pickup_address: pickupAddress,
      seller_phone: sellerPhone,
      seller_name: sellerName,
      calculated_delivery_type: order.calculated_delivery_type,
      immediate_timing_config: order.immediate_timing_config,
      original_created_at: order.original_created_at,
      agent_id: order.agent_id
    };
  }, []);
  
  // Calculate distances with caching - single memoized calculation
  const ordersWithDistances = useMemo(() => {
    if (!realtimeOrders || realtimeOrders.length === 0) return [];
    if (!location.latitude || !location.longitude) return realtimeOrders;
    
    setIsLoadingDistance(true);
    const agentLocation = { lat: location.latitude, lng: location.longitude };
    
    const calculateDistances = async () => {
      const results = await Promise.all(
        realtimeOrders.map(async (order) => {
          try {
            const pickupCoords = order.pickup_location;
            const customerCoords = extractCoordinatesFromAddress(order.original_address || order.address);
            
            if (!pickupCoords || !customerCoords) {
              return { 
                ...order, 
                distance_km: 2.5, 
                eta_mins: 5, 
                agent_to_shop_distance: 2.0,
                distance_source: 'fallback' as const 
              };
            }
            
            // Calculate shop to customer distance
            const distanceResult = await calculateRealTimeDistance(pickupCoords, customerCoords, order.id);
            
            // Calculate agent to shop distance using backend
            try {
              const { data, error } = await supabase.functions.invoke('calculate-delivery-pricing', {
                body: {
                  order_id: order.id,
                  agent_location: agentLocation
                }
              });
              
              if (!error && data?.success) {
                return {
                  ...order,
                  distance_km: distanceResult.distance_km,
                  eta_mins: distanceResult.eta_mins,
                  agent_to_shop_distance: data.distance_km || 2.0,
                  total_distance: (data.distance_km || 2.0) + distanceResult.distance_km,
                  agent_payout: data.payout_amount || 0,
                  distance_source: distanceResult.source,
                  backend_calculated: true
                };
              }
            } catch (error) {
              console.warn('Backend distance calculation failed:', error);
            }
            
            return {
              ...order,
              distance_km: distanceResult.distance_km,
              eta_mins: distanceResult.eta_mins,
              agent_to_shop_distance: 2.0,
              distance_source: distanceResult.source
            };
          } catch (error) {
            console.error('Distance calculation error:', error);
            return { 
              ...order, 
              distance_km: 2.5, 
              eta_mins: 5, 
              agent_to_shop_distance: 2.0,
              distance_source: 'error' as const 
            };
          }
        })
      );
      
      setIsLoadingDistance(false);
      return results;
    };
    
    return calculateDistances();
  }, [realtimeOrders, location.latitude, location.longitude]);
  
  // Filter and sort orders - single memoization
  const filteredAndSortedOrders = useMemo(() => {
    const processOrders = async () => {
      const orders = await ordersWithDistances;
      if (!orders) return { available: [], assigned: [] };
      
      // Filter: within 15km, not delivered, not expired, not rejected
      const filtered = orders.filter(order => {
        if (rejectedOrderIds.has(order.id)) return false;
        if (order.status === 'delivered') return false;
        if (order.agent_to_shop_distance && order.agent_to_shop_distance > 15) return false;
        
        const now = new Date();
        const orderDate = new Date(order.created_at);
        const hoursOld = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60);
        if (hoursOld > 24) return false;
        
        return true;
      });
      
      // Sort by selected criteria
      const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'nearest') {
          return (a.agent_to_shop_distance || 999) - (b.agent_to_shop_distance || 999);
        } else if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else if (sortBy === 'highest') {
          return (b.agent_payout || 0) - (a.agent_payout || 0);
        }
        return 0;
      });
      
      return {
        available: sorted.filter(o => o.status === 'packed' && !o.agent_id),
        assigned: sorted.filter(o => ['assigned', 'picked_up', 'in_transit'].includes(o.status))
      };
    };
    
    return processOrders();
  }, [ordersWithDistances, sortBy, rejectedOrderIds]);
  
  // Callbacks - all memoized
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await realtimeRefresh();
      toast({
        title: "Refreshed",
        description: "Orders updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh orders",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [realtimeRefresh, toast]);
  
  const handleAcceptOrder = useCallback(async (orderId: string) => {
    setAcceptingOrders(prev => ({ ...prev, [orderId]: true }));
    try {
      await realtimeAcceptOrder(orderId);
      toast({
        title: "Order Accepted",
        description: "You can now proceed with the delivery",
      });
      navigate(`/delivery-details/${orderId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept order",
        variant: "destructive",
      });
    } finally {
      setAcceptingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  }, [realtimeAcceptOrder, toast, navigate]);
  
  const handleRejectOrder = useCallback(async (orderId: string) => {
    setRejectingOrders(prev => ({ ...prev, [orderId]: true }));
    const newRejectedIds = new Set(rejectedOrderIds);
    newRejectedIds.add(orderId);
    setRejectedOrderIds(newRejectedIds);
    localStorage.setItem('rejectedOrderIds', JSON.stringify([...newRejectedIds]));
    
    try {
      await supabase.functions.invoke('cancel-delivery', {
        body: { order_id: orderId }
      });
    } catch (error) {
      console.error('Error rejecting order:', error);
    } finally {
      setRejectingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  }, [rejectedOrderIds]);
  
  // Effects - consolidated
  
  // 1. Location display update
  useEffect(() => {
    if (location.address) {
      setCurrentLocation(location.address);
    } else if (location.latitude && location.longitude) {
      setCurrentLocation(`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
    }
  }, [location.address, location.latitude, location.longitude]);
  
  // 2. Realtime broadcast listeners
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime-updates')
      .on('broadcast', { event: 'order_assigned' }, (payload) => {
        console.log('Order assigned:', payload);
        toast({
          title: "Order Accepted",
          description: "This order was accepted by another agent",
          duration: 3000,
        });
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);
  
  // 3. Window event listeners
  useEffect(() => {
    const handleOrderCompleted = () => {
      realtimeRefresh();
    };
    
    const handleRefreshOrders = () => {
      handleRefresh();
    };
    
    window.addEventListener('orderCompleted', handleOrderCompleted);
    window.addEventListener('refreshOrders', handleRefreshOrders);
    
    return () => {
      window.removeEventListener('orderCompleted', handleOrderCompleted);
      window.removeEventListener('refreshOrders', handleRefreshOrders);
    };
  }, [realtimeRefresh, handleRefresh]);
  
  // 4. Cleanup rejected orders (daily)
  useEffect(() => {
    const cleanupRejectedOrders = () => {
      const lastCleanup = localStorage.getItem('rejectedOrdersLastCleanup');
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      if (lastCleanup && parseInt(lastCleanup) > sevenDaysAgo) return;
      
      localStorage.removeItem('rejectedOrderIds');
      localStorage.setItem('rejectedOrdersLastCleanup', Date.now().toString());
      setRejectedOrderIds(new Set());
    };
    
    cleanupRejectedOrders();
    const interval = setInterval(cleanupRejectedOrders, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Loading states
  if (isLoadingAgent || !agent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-12 mx-auto rounded-full" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    );
  }
  
  if (location.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <MapPin className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Detecting your location...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background pb-20">
      <OfflineCompletionsQueue />
      
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{getGreeting()}</h1>
              <p className="text-sm text-muted-foreground">{agent.name || 'Agent'}</p>
            </div>
            <Button
              variant={isOnline ? "default" : "outline"}
              size="sm"
              onClick={() => setIsOnline(!isOnline)}
            >
              {isOnline ? "Online" : "Offline"}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <LocationPicker onLocationSelected={(loc) => setCurrentLocation(loc.address)}>
              <Button variant="outline" size="sm" className="flex-1">
                <MapPin className="h-4 w-4 mr-2" />
                <span className="truncate">{currentLocation}</span>
              </Button>
            </LocationPicker>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">Nearest First</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="highest">Highest Payout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Orders */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="p-4">
          <OrdersList
            filteredAndSortedOrders={filteredAndSortedOrders}
            isLoadingRealtime={isLoadingRealtime}
            isLoadingDistance={isLoadingDistance}
            acceptingOrders={acceptingOrders}
            rejectingOrders={rejectingOrders}
            onAccept={handleAcceptOrder}
            onReject={handleRejectOrder}
            calculateAgentPayout={calculateAgentPayout}
          />
        </div>
      </ScrollArea>
    </div>
  );
};

// Separate component for rendering orders to handle async state
const OrdersList = ({ 
  filteredAndSortedOrders, 
  isLoadingRealtime,
  isLoadingDistance,
  acceptingOrders,
  rejectingOrders,
  onAccept,
  onReject,
  calculateAgentPayout
}: {
  filteredAndSortedOrders: Promise<{ available: Order[]; assigned: Order[] }>;
  isLoadingRealtime: boolean;
  isLoadingDistance: boolean;
  acceptingOrders: Record<string, boolean>;
  rejectingOrders: Record<string, boolean>;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  calculateAgentPayout: (distance: number) => number;
}) => {
  const [orders, setOrders] = useState<{ available: Order[]; assigned: Order[] }>({ available: [], assigned: [] });
  
  useEffect(() => {
    filteredAndSortedOrders.then(setOrders);
  }, [filteredAndSortedOrders]);
  
  if (isLoadingRealtime) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (orders.assigned.length === 0 && orders.available.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No orders available</p>
          <p className="text-sm">Pull down to refresh</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {orders.assigned.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Your Deliveries ({orders.assigned.length})</h2>
          {orders.assigned.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isLoadingDistance={isLoadingDistance}
              acceptingOrders={acceptingOrders}
              rejectingOrders={rejectingOrders}
              onAccept={onAccept}
              onReject={onReject}
              calculateAgentPayout={calculateAgentPayout}
            />
          ))}
        </div>
      )}
      
      {orders.available.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Available Orders ({orders.available.length})</h2>
          {orders.available.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isLoadingDistance={isLoadingDistance}
              acceptingOrders={acceptingOrders}
              rejectingOrders={rejectingOrders}
              onAccept={onAccept}
              onReject={onReject}
              calculateAgentPayout={calculateAgentPayout}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
