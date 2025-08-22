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
  Loader2
} from "lucide-react";
import { QrScannerDialog } from "@/components/QrScannerDialog";

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
}


const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Get current location with auto-refresh and backend saving
  const location = useGeolocation({
    enableHighAccuracy: true,
    saveToBackend: true,
    refreshInterval: 10000, // Refresh every 10 seconds
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
  
  // Calculate agent payout based on real distance (updated rates)
  const calculateAgentPayout = (distance: number) => {
    const basePay = 20; // Increased base pay for first 1 km
    const additionalDistance = Math.max(0, distance - 1); // Distance beyond 1 km
    const perKmRate = 15; // Increased rate per km for fair pricing
    const distancePay = additionalDistance * perKmRate;
    
    return basePay + distancePay;
  };

  // Fetch orders from backend
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['placed', 'assigned'])
        .neq('status', 'delivered') // Exclude delivered orders
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform backend data to match our interface
      const transformedOrders: Order[] = (data || []).map(order => ({
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
        restaurant: Array.isArray(order.items) && order.items[0] ? (order.items[0] as any).restaurant || 'Restaurant' : 'Restaurant'
      }));

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

  // Calculate distance and ETA for orders using backend service
  const calculateDistanceETA = async (orders: Order[]) => {
    // Use real agent location if available, fallback to default
    const agentLocation = location.latitude && location.longitude 
      ? { lat: location.latitude, lng: location.longitude }
      : { lat: 31.2556, lng: 75.7045 }; // Fallback location
    
    const updatedOrders = await Promise.all(
      orders.map(async (order) => {
        try {
          if (!order.coordinates) {
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

  // Calculate distances when orders change or location updates
  useEffect(() => {
    if (orders.length > 0 && (location.latitude && location.longitude)) {
      calculateDistanceETA(orders);
    }
  }, [orders, location.latitude, location.longitude]);

  // Fetch orders on component mount and listen for order completion
  useEffect(() => {
    fetchOrders();
    
    // Listen for order completion events from QR scanner
    const handleOrderCompleted = () => {
      fetchOrders();
    };
    
    window.addEventListener('orderCompleted', handleOrderCompleted);
    
    return () => {
      window.removeEventListener('orderCompleted', handleOrderCompleted);
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

  // Accept order
  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingOrders(prev => ({ ...prev, [orderId]: true }));
    
    try {
      // Update order status to 'assigned' and assign to agent
      const agentEmail = localStorage.getItem('agent_email') || 'seshethoti@gmail.com';
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', agentEmail)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        throw new Error('Agent not found');
      }

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'assigned',
          agent_id: agent.id
        })
        .eq('id', orderId);

      if (error) throw error;

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
      
      toast({
        title: "Order Accepted!",
        description: "You can now manage this delivery",
      });
      
    } catch (error) {
      console.error('Error accepting order:', error);
      toast({
        title: "Error",
        description: "Failed to accept order",
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
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;

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

  // Show available orders (no filtering needed anymore)
  const availableOrders = ordersWithDistance;


  // Loading skeleton
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
            <div className="flex items-center text-sm text-muted-foreground">
              {location.loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Getting location...
                </>
              ) : location.error ? (
                <>
                  <MapPin className="w-4 h-4 mr-2 text-destructive" />
                  Location unavailable
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 mr-2 text-primary" />
                  {location.address || 'Location detected'}
                </>
              )}
            </div>
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
              <h2 className="text-lg font-semibold text-foreground">
                Available Orders ({availableOrders.length})
              </h2>
            </div>

            {isLoading ? (
              <LoadingSkeleton />
            ) : availableOrders.length === 0 ? (
              <Card className="bg-card/50 border-border">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
                  <p className="text-muted-foreground mb-4">
                    {isOnline 
                      ? "New orders will appear here" 
                      : "Go online to see available orders"
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

                        {/* Order Details */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 mr-2 text-primary" />
                            {address}
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center text-muted-foreground">
                              <Navigation className="w-4 h-4 mr-1 text-primary" />
                              {order.distance_km} km
                            </div>
                            <div className="flex items-center text-muted-foreground">
                              <Clock className="w-4 h-4 mr-1 text-primary" />
                              {order.delivery_time}
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
                          
                           {/* Agent Payout */}
                           <div className="flex items-center text-sm text-green-600 font-medium mt-2">
                             <IndianRupee className="w-4 h-4 mr-1" />
                             Agent payout: ₹{calculateAgentPayout(order.distance_km || 2.5).toFixed(0)}
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