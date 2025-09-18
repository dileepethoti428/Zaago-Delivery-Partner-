
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";
import { 
  MapPin, 
  Clock, 
  IndianRupee, 
  Package, 
  Navigation,
  Zap,
  Bell,
  Settings,
  RefreshCw,
  CheckCircle,
  X,
  User,
  QrCode,
  Loader2,
  PackageOpen,
  Target,
  MapPinOff,
  Trophy,
  BarChart3,
  ChevronDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { LocationPicker } from "@/components/LocationPicker";
import DeliveryTimer from "@/components/DeliveryTimer";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: any;
  items: any[];
  total: number;
  status: string;
  delivery_date: string;
  created_at: string;
  payment_status: string;
  coordinates?: { lat: number; lng: number };
  distance_km?: number;
  delivery_time?: string;
  products_count?: number;
  restaurant?: string;
  backend_calculated?: boolean;
  delivery_type?: 'immediate' | 'scheduled';
  scheduled_time?: string;
  order_placed_at?: Date;
  agent_payout?: number;
  estimated_time_minutes?: number;
}


const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Get current location with backend saving (no auto-refresh)
  const location = useGeolocation({
    enableHighAccuracy: false, // Use network location for speed
    timeout: 3000, // Fast timeout for initial detection
    saveToBackend: true,
    refreshInterval: 0, // Disabled auto-refresh
  });
  
  // State management
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notificationCount] = useState(3);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [ordersWithDistance, setOrdersWithDistance] = useState<Order[]>([]);
  const [acceptingOrders, setAcceptingOrders] = useState<Record<string, boolean>>({});
  const [rejectingOrders, setRejectingOrders] = useState<Record<string, boolean>>({});
  const [agentName, setAgentName] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("nearest");

  // Get greeting based on current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Capitalize first letter of each word
  const capitalizeWords = (str: string) => {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Fetch agent name
  const fetchAgentName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('name')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agent?.name) {
        setAgentName(capitalizeWords(agent.name));
      }
    } catch (error) {
      console.error('Error fetching agent name:', error);
    }
  };
  
  // Calculate agent payout using backend service for accurate pricing
  const calculateAgentPayoutFromBackend = async (orderId: string, agentLocation?: {lat: number, lng: number}) => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-delivery-pricing', {
        body: {
          order_id: orderId,
          agent_location: agentLocation
        }
      });

      if (error) throw error;

      return {
        payout: data.agent_payout,
        distance: data.distance_km,
        estimatedTime: data.estimated_time_minutes,
        breakdown: data.breakdown
      };
    } catch (error) {
      console.error('Failed to calculate pricing from backend:', error);
      // Fallback calculation
      const fallbackDistance = 2.5;
      const basePay = 20;
      const additionalDistance = Math.max(0, fallbackDistance - 1);
      const perKmRate = 15;
      const distancePay = additionalDistance * perKmRate;
      
      return {
        payout: basePay + distancePay,
        distance: fallbackDistance,
        estimatedTime: Math.ceil(fallbackDistance * 2),
        breakdown: {
          base_pay: basePay,
          additional_distance: additionalDistance,
          per_km_rate: perKmRate,
          distance_pay: distancePay
        }
      };
    }
  };

  // Synchronous payout calculation for display (using stored distance)
  const calculateAgentPayout = (distance: number) => {
    const basePay = 20; // Base pay for first 1 km
    const additionalDistance = Math.max(0, distance - 1); // Distance beyond 1 km
    const perKmRate = 15; // Rate per km for additional distance
    const distancePay = additionalDistance * perKmRate;
    
    return basePay + distancePay;
  };

  // Fetch orders from backend (filtered by agent exclusions)
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      // Get current agent ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('Not authenticated');
      }
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        throw new Error('Agent not found');
      }

      // Use edge function to get filtered orders
      const { data: response, error } = await supabase.functions.invoke('get-available-orders', {
        body: { agent_id: agent.id }
      });

      if (error) throw error;

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch orders');
      }

      // Transform backend data to match our interface
      const transformedOrders: Order[] = (response.orders || []).map((order, index) => {
        // Safely parse scheduled time
        let scheduledTime = null;
        if (order.delivery_time_slot && order.delivery_date) {
          try {
            // Handle different time slot formats
            const timeSlot = order.delivery_time_slot;
            let timeString = '';
            
            if (timeSlot.includes('-')) {
              // Format like "morning-early" or "18:00-20:00"
              const timePart = timeSlot.split('-')[0];
              if (timePart.includes(':')) {
                timeString = timePart + ':00';
              } else {
                // Map text slots to times
                const timeMap = {
                  'morning': '08:00:00',
                  'afternoon': '14:00:00',
                  'evening': '18:00:00'
                };
                timeString = timeMap[timePart] || '12:00:00';
              }
            } else if (timeSlot.includes(':')) {
              timeString = timeSlot + ':00';
            } else {
              timeString = '12:00:00'; // fallback
            }
            
            const dateTimeString = order.delivery_date + 'T' + timeString;
            const date = new Date(dateTimeString);
            
            // Validate the date
            if (!isNaN(date.getTime())) {
              scheduledTime = date.toISOString();
            }
          } catch (error) {
            console.warn('Failed to parse scheduled time for order:', order.id, error);
          }
        }

        return {
          id: order.id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          address: order.address,
          items: Array.isArray(order.items) ? order.items : [],
          total: order.total,
          status: order.status,
          delivery_date: order.delivery_date,
          created_at: order.created_at,
          payment_status: order.payment_status,
          coordinates: (order.address as any)?.coordinates,
          products_count: Array.isArray(order.items) ? order.items.length : 1,
          restaurant: Array.isArray(order.items) && order.items[0] ? (order.items[0] as any).restaurant || 'Restaurant' : 'Restaurant',
          // Use backend-calculated distance and payout if available, otherwise calculate
          distance_km: order.distance_km || undefined,
          agent_payout: order.agent_payout || undefined,
          estimated_time_minutes: order.estimated_time_minutes || undefined,
          backend_calculated: order.distance_km ? true : false,
          // Determine delivery type based on actual order data
          delivery_type: order.delivery_time_slot ? 'scheduled' : 'immediate',
          scheduled_time: scheduledTime,
          order_placed_at: new Date(order.created_at)
        };
      });

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Process orders with backend-calculated distances (prioritize backend data)
  const processOrdersWithDistances = async (orders: Order[]) => {
    // Use real agent location if available
    const agentLocation = location.latitude && location.longitude 
      ? { lat: location.latitude, lng: location.longitude }
      : null;
    
    const updatedOrders = await Promise.all(
      orders.map(async (order) => {
        // Always use backend-calculated distance if available
        if (order.distance_km !== undefined) {
          return {
            ...order,
            delivery_time: `${Math.ceil(order.distance_km * 2)} min`, // 2 minutes per km
            backend_calculated: true
          };
        }

        // Only recalculate if no backend distance and we have coordinates
        try {
          if (!order.coordinates || !agentLocation) {
            return {
              ...order,
              distance_km: 2.5, // fallback
              delivery_time: "5 min",
              backend_calculated: false
            };
          }

          const { data, error } = await supabase.functions.invoke('calculate-distance-eta', {
            body: {
              origin: agentLocation,
              destination: order.coordinates
            }
          });

          if (error) throw error;

          return {
            ...order,
            distance_km: data.distance_km,
            delivery_time: `${data.eta_mins} min`,
            backend_calculated: true
          };
        } catch (error) {
          console.error('Failed to calculate distance for order:', order.id, error);
          // Keep fallback values on error
          return {
            ...order,
            distance_km: 2.5,
            delivery_time: "5 min",
            backend_calculated: false
          };
        }
      })
    );
    
    setOrdersWithDistance(updatedOrders);
  };

  // Process orders with distances when they change (not when location changes)
  useEffect(() => {
    if (orders.length > 0) {
      // Process orders, prioritizing backend-calculated distances
      processOrdersWithDistances(orders);
    }
  }, [orders]); // Removed location dependencies to prevent constant updates

  useEffect(() => {
    fetchOrders();
    fetchAgentName();
    
    // Listen for order completion events from QR scanner
    const handleOrderCompleted = (e: Event) => {
      const event = e as CustomEvent<{ orderId?: string }>;
      const completedId = event.detail?.orderId;
      if (completedId) {
        setOrders(prev => prev.filter(o => o.id !== completedId));
        setOrdersWithDistance(prev => prev.filter(o => o.id !== completedId));
      }
      fetchOrders();
    };
    
    // Listen for order cancellation events
    const handleOrderCancelled = () => {
      fetchOrders();
    };
    window.addEventListener('orderCompleted', handleOrderCompleted);
    window.addEventListener('orderCancelled', handleOrderCancelled);
    
    // Set up real-time subscription for orders table
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order updated:', payload);
          
           // If an order status changed to 'placed' (released back to all agents)
          if (payload.new.status === 'placed' && payload.old.status === 'assigned') {
            toast({
              title: "New Order Available!",
              description: `Order from ${payload.new.customer_name} is now available`,
            });
            // Refresh orders to show the newly available order
            fetchOrders();
          }
          
          // If an order status changes from 'packed' to 'assigned', remove it from view
          if (payload.old.status === 'packed' && payload.new.status === 'assigned') {
            setOrders(prev => prev.filter(order => order.id !== payload.new.id));
            setOrdersWithDistance(prev => prev.filter(order => order.id !== payload.new.id));
            
            toast({
              title: "Order Taken",
              description: "This order was accepted by another agent",
              variant: "default"
            });
          }
          
          // If an order was delivered or cancelled, remove it
          if (payload.new.status === 'delivered' || payload.new.status === 'cancelled') {
            setOrders(prev => prev.filter(order => order.id !== payload.new.id));
            setOrdersWithDistance(prev => prev.filter(order => order.id !== payload.new.id));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('New order created:', payload);
          
          // If a new order is packed, check if it's not already in our list to prevent duplicates
          if (payload.new.status === 'packed') {
            // Check if order already exists to prevent duplicates
            const orderExists = orders.some(order => order.id === payload.new.id) || 
                              ordersWithDistance.some(order => order.id === payload.new.id);
            
            if (!orderExists) {
              toast({
                title: "New Order Available!",
                description: `New order from ${payload.new.customer_name}`,
              });
              fetchOrders();
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      window.removeEventListener('orderCompleted', handleOrderCompleted);
      window.removeEventListener('orderCancelled', handleOrderCancelled);
      supabase.removeChannel(channel);
    };
  }, []);

  // Pull to refresh functionality
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOrders();
    setIsRefreshing(false);
    
    toast({
      title: "Orders Updated!",
      description: "Latest delivery requests loaded",
    });
  };

  // Accept order - Updated with better error handling and RLS compliance
  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingOrders(prev => ({ ...prev, [orderId]: true }));
    
    try {
      // Get current authenticated user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('Not authenticated');
      }
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        throw new Error(`Agent not found for email: ${user.email}. Please contact admin for activation.`);
      }

      // Update order with specific conditions to work with RLS policies
      const { data: updated, error } = await supabase
        .from('orders')
        .update({ 
          status: 'assigned',
          agent_id: agent.id
        })
        .eq('id', orderId)
        .eq('status', 'packed')  // Only accept orders that are still 'packed'
        .is('agent_id', null)   // Only accept unassigned orders
        .select('id, status, agent_id')
        .maybeSingle();

      if (error) {
        console.error('Database error:', error);
        throw new Error(error.message || 'Failed to accept order');
      }

      if (!updated || updated.status !== 'assigned' || updated.agent_id !== agent.id) {
        throw new Error('This order is no longer available. It may have been accepted by another agent.');
      }

      // Update order in state to show as assigned
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: 'assigned' }
          : order
      ));
      
      setOrdersWithDistance(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: 'assigned' }
          : order
      ));
      
      // Refresh orders to get latest state
      await fetchOrders();
      
      toast({
        title: "Order Accepted!",
        description: "You can now manage this delivery",
      });
      
    } catch (error: any) {
      console.error('Error accepting order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept order",
        variant: "destructive"
      });
    } finally {
      setAcceptingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Reject order
  const handleRejectOrder = async (orderId: string) => {
    setRejectingOrders(prev => ({ ...prev, [orderId]: true }));
    
    try {
      // Get current authenticated user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('Not authenticated');
      }
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        throw new Error('Agent not found');
      }

      const { data, error } = await supabase.functions.invoke('cancel-delivery', {
        body: {
          order_id: orderId,
          agent_id: agent.id,
          cancellation_reason: 'Agent rejected delivery'
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to reject order');
      }

      // Remove from local orders list
      setOrders(prev => prev.filter(order => order.id !== orderId));
      setOrdersWithDistance(prev => prev.filter(order => order.id !== orderId));
      
      toast({
        title: "Order Rejected",
        description: `Order has been rejected`,
        variant: "destructive"
      });
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast({
        title: "Error",
        description: "Failed to reject order",
        variant: "destructive"
      });
    } finally {
      setRejectingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Sort orders based on selected criteria
  const getSortedOrders = () => {
    // Use ordersWithDistance if available, otherwise fallback to orders
    const ordersToSort = ordersWithDistance.length > 0 ? [...ordersWithDistance] : [...orders];
    
    switch (sortBy) {
      case "nearest":
        return ordersToSort.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
      case "furthest":
        return ordersToSort.sort((a, b) => (b.distance_km || 0) - (a.distance_km || 0));
      case "newest":
        return ordersToSort.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "oldest":
        return ordersToSort.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "highest":
        return ordersToSort.sort((a, b) => b.total - a.total);
      case "lowest":
        return ordersToSort.sort((a, b) => a.total - b.total);
      default:
        return ordersToSort;
    }
  };

  const availableOrders = getSortedOrders();

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="space-y-2 mb-4">
              <Skeleton className="h-3 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-12" />
              <Skeleton className="h-10 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Top App Bar */}
      <div className="bg-card/80 backdrop-blur-lg border-b border-primary/20 shadow-neon sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-foreground">
              Zaago Delivery Agent
            </h1>
            <LocationPicker onLocationSelected={(loc) => {
              toast({
                title: "Location Updated",
                description: `Location set to: ${loc.address}`,
              });
            }}>
              <div className="flex items-center text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                {location.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Getting location...
                  </>
                ) : location.error ? (
                  <>
                    <MapPin className="w-4 h-4 mr-2 text-destructive" />
                    Tap to set location
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-2 text-primary" />
                    {location.address || 
                     (location.latitude && location.longitude ? 
                       `${location.latitude.toFixed(3)}°N, ${location.longitude.toFixed(3)}°E` : 
                       'Tap to update location')}
                  </>
                )}
              </div>
            </LocationPicker>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-primary/10"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="w-5 h-5 text-foreground" />
              {notificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs animate-pulse">
                  {notificationCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/10"
              onClick={() => navigate('/profile')}
            >
              <User className="w-5 h-5 text-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Greeting */}
          {agentName && (
            <div className="text-center animate-fade-in">
              <div className="text-2xl font-bold text-primary">
                {getGreeting()} {agentName}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Ready to deliver excellence
              </div>
            </div>
          )}
          
          {/* Quick Services */}
          <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20 animate-slide-up">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Quick Services</h3>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => setIsOnline(!isOnline)}
                  className={`${
                    isOnline 
                      ? "bg-destructive hover:bg-destructive/80" 
                      : "bg-gradient-neon hover:shadow-neon hover:scale-105"
                  } transition-all duration-300 flex-col h-16`}
                >
                  <Zap className="w-5 h-5 mb-1" />
                  <span className="text-xs">
                    {isOnline ? "Go Offline" : "Go Online"}
                  </span>
                </Button>
                
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="outline"
                  className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300 flex-col h-16"
                >
                  <RefreshCw className={`w-5 h-5 mb-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="text-xs">Refresh</span>
                </Button>
                
                <Button
                  onClick={() => setShowQrScanner(true)}
                  variant="outline"
                  className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300 flex-col h-16"
                >
                  <QrCode className="w-5 h-5 mb-1" />
                  <span className="text-xs">Scan QR</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          <div className="animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Orders ({availableOrders.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Available orders and your assignments
                </p>
              </div>
              
              {/* Sort Dropdown */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44 h-9 bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="nearest" className="cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <Target className="w-4 h-4 text-primary" />
                      <span>Nearest First</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="furthest" className="cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <MapPinOff className="w-4 h-4 text-destructive" />
                      <span>Furthest First</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="newest" className="cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>Newest First</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="oldest" className="cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>Oldest First</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="highest" className="cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>Highest Amount</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lowest" className="cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-green-500" />
                      <span>Lowest Amount</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <LoadingSkeleton />
            ) : availableOrders.length === 0 ? (
              <Card className="bg-card/50 border-border">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <PackageOpen className="w-16 h-16 text-primary/60" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No nearby orders</h3>
                  <p className="text-muted-foreground mb-4">
                    No orders within 15km radius currently available. 
                    {location.latitude && location.longitude 
                      ? " Try moving to a different area or check back later! 🌟" 
                      : " Enable location access to see nearby orders! 📍"
                    }
                  </p>
                  {!isOnline && (
                    <Button
                      onClick={() => setIsOnline(true)}
                      className="bg-gradient-neon hover:shadow-neon transition-smooth"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Go Online
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {availableOrders.map((order, index) => {
                  const restaurant = order.items?.[0]?.restaurant || order.restaurant || 'Restaurant';
                  const address = `${order.address?.addressLine1 || ''}, ${order.address?.city || ''}`.trim();
                  
                  return (
                    <Card 
                      key={order.id} 
                      className="bg-card border-border hover:shadow-neon hover:scale-[1.02] transition-all duration-300 animate-fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="p-4">
                         {/* Order Header */}
                         <div className="flex items-center justify-between mb-3">
                           <div>
                             <h3 className="font-semibold text-foreground">{order.customer_name}</h3>
                             <p className="text-sm text-muted-foreground">
                               {restaurant} • Order #{order.id.substring(0, 8)}...
                             </p>
                           </div>
                         </div>

                         {/* Delivery Timer */}
                         {(order.delivery_type || order.scheduled_time) && (
                           <div className="mb-4">
                             <DeliveryTimer
                               deliveryType={order.delivery_type || 'immediate'}
                               scheduledTime={order.scheduled_time || undefined}
                               orderPlacedAt={order.order_placed_at}
                               className="text-xs"
                             />
                           </div>
                         )}

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 mr-2 text-primary" />
                            {address}
                          </div>
                          
                           <div className="grid grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center text-muted-foreground">
                              <Navigation className="w-4 h-4 mr-1 text-primary" />
                              {order.distance_km !== undefined ? `${order.distance_km.toFixed(1)} km` : 'Calculating...'}
                            </div>
                            <div className="flex items-center text-muted-foreground">
                              <Clock className="w-4 h-4 mr-1 text-primary" />
                              {order.delivery_time || 'Calculating...'}
                            </div>
                            <div className="flex items-center text-muted-foreground">
                              <Package className="w-4 h-4 mr-1 text-primary" />
                              {order.products_count} products
                            </div>
                            <div className="flex items-center text-primary font-semibold">
                              <IndianRupee className="w-4 h-4 mr-1" />
                              ₹{order.total}
                            </div>
                          </div>
                          
                           <div className="flex items-center justify-between text-sm mt-2">
                              <div className="flex items-center text-green-600 font-medium">
                                <IndianRupee className="w-4 h-4 mr-1" />
                                Agent payout: ₹{order.agent_payout ? order.agent_payout.toFixed(0) : calculateAgentPayout(order.distance_km || 0).toFixed(0)}
                              </div>
                             {order.backend_calculated && (
                               <Badge variant="secondary" className="text-xs">
                                 Real-time distance
                               </Badge>
                             )}
                           </div>
                        </div>

                        {/* Action Buttons */}
                        {order.status === 'assigned' ? (
                          <div className="flex space-x-2">
                            <Button 
                              onClick={() => navigate(`/delivery-details/${order.id}`)}
                              className="flex-1 bg-gradient-neon hover:shadow-neon hover:scale-105 transition-all duration-300"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Manage Delivery
                            </Button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <Button 
                              onClick={() => handleAcceptOrder(order.id)}
                              className="flex-1 bg-gradient-neon hover:shadow-neon hover:scale-105 transition-all duration-300"
                              disabled={acceptingOrders[order.id]}
                            >
                              {acceptingOrders[order.id] ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                  Accepting...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Accept
                                </>
                              )}
                            </Button>
                            
                            <Button 
                              variant="outline"
                              onClick={() => handleRejectOrder(order.id)}
                              className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 hover:shadow-neon transition-all duration-300"
                              disabled={rejectingOrders[order.id]}
                            >
                              {rejectingOrders[order.id] ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-destructive border-t-transparent mr-2" />
                                  Rejecting...
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* QR Scanner Dialog */}
      <QrScannerDialog 
        open={showQrScanner} 
        onOpenChange={setShowQrScanner} 
      />
    </div>
  );
};

export default Home;
