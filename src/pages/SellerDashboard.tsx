import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAudioNotification, RingtoneSettings } from "@/hooks/useAudioNotification";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, 
  Clock, 
  IndianRupee, 
  User,
  Bell,
  Store,
  CheckCircle,
  PackageOpen,
  Truck,
  LogOut
} from "lucide-react";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: any;
  items: any;
  total: number;
  status: string;
  created_at: string;
  payment_status: string;
}

const SellerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Ringtone settings state
  const [ringtoneSettings, setRingtoneSettings] = useState<RingtoneSettings>({
    enabled: true,
    volume: 0.8,
    type: 'phone-ringtone',
    frequency: 'double'
  });
  
  const { playNotificationSound } = useAudioNotification(ringtoneSettings);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [recentPackedNotifications, setRecentPackedNotifications] = useState<Set<string>>(new Set());
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('disconnected');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Load seller settings
  const loadSellerSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get agent details (sellers might also have agent accounts)
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agent) {
        // Get agent settings
        const { data: agentSettings } = await supabase
          .from('agent_settings')
          .select('ringtone_enabled, ringtone_volume, ringtone_type, notification_frequency')
          .eq('agent_id', agent.id)
          .maybeSingle();

        if (agentSettings) {
          setRingtoneSettings({
            enabled: agentSettings.ringtone_enabled ?? true,
            volume: agentSettings.ringtone_volume ?? 0.8,
            type: agentSettings.ringtone_type ?? 'phone-ringtone',
            frequency: agentSettings.notification_frequency ?? 'double'
          });
        }
      }
    } catch (error) {
      console.error('Error loading seller settings:', error);
    }
  };

  // Add debug log helper
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log('🔍 DEBUG:', logEntry);
    setDebugLogs(prev => [...prev.slice(-9), logEntry]); // Keep last 10 logs
  };

  // Check if user is authenticated seller
  const checkSellerAuth = async () => {
    try {
      addDebugLog('Starting seller authentication check...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addDebugLog('No authenticated user found, redirecting to login');
        navigate('/login');
        return false;
      }
      addDebugLog(`User authenticated: ${user.id}`);

      // Check if user is a seller
      const { data: seller, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('user_id', user.id)
        .eq('approval_status', 'approved')
        .single();

      if (error) {
        addDebugLog(`Seller query error: ${error.message}`);
      }

      if (!seller) {
        addDebugLog('User is not an approved seller');
        toast({
          title: "Access Denied",
          description: "You don't have seller access or your account is not approved.",
          variant: "destructive",
        });
        navigate('/');
        return false;
      }

      addDebugLog(`Seller authenticated: ${seller.business_name || seller.name}`);
      setSellerInfo(seller);
      return true;
    } catch (error) {
      addDebugLog(`Auth check error: ${error}`);
      console.error('Auth check error:', error);
      navigate('/login');
      return false;
    }
  };

  // Fetch seller's orders
  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (orders) {
        setOrders(orders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new order notification (INSERT events)
  const handleNewOrderNotification = (orderData: any) => {
    addDebugLog(`🆕 Processing new order notification: ${orderData.id} - Status: ${orderData.status}`);
    
    // Prevent duplicate notifications
    if (recentPackedNotifications.has(orderData.id)) {
      addDebugLog(`Skipping notification - already notified for order: ${orderData.id}`);
      return;
    }

    addDebugLog(`🔔 Playing ringtone for new order: ${orderData.id}`);
    
    // Add to recent notifications to prevent duplicates
    setRecentPackedNotifications(prev => new Set(prev).add(orderData.id));
    
    // Remove from recent notifications after 30 seconds
    setTimeout(() => {
      setRecentPackedNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderData.id);
        return newSet;
      });
    }, 30000);

    try {
      // Play the ringtone only if enabled
      if (ringtoneSettings.enabled) {
        playNotificationSound();
      }
      addDebugLog(`✅ Ringtone played successfully for new order: ${orderData.id}`);
      
      // Show toast notification
      toast({
        title: "🔔 New Order Received!",
        description: `New order from ${orderData.customer_name} - ${formatCurrency(orderData.total)}`,
        duration: 5000,
      });
      addDebugLog(`✅ Toast notification shown for new order: ${orderData.id}`);
    } catch (error) {
      addDebugLog(`❌ Error playing notification: ${error}`);
    }
  };

  // Handle packed order notification (UPDATE events)
  const handlePackedOrderNotification = (orderData: any) => {
    addDebugLog(`Processing packed order notification: ${orderData.id} - Status: ${orderData.status}`);
    
    // Only play for orders that just got packed and haven't been notified recently
    if (orderData.status !== 'packed') {
      addDebugLog(`Skipping notification - order status is not 'packed': ${orderData.status}`);
      return;
    }
    
    if (recentPackedNotifications.has(orderData.id)) {
      addDebugLog(`Skipping notification - already notified for order: ${orderData.id}`);
      return;
    }

    addDebugLog(`🔔 Playing ringtone for packed order: ${orderData.id}`);
    
    // Add to recent notifications to prevent duplicates
    setRecentPackedNotifications(prev => new Set(prev).add(orderData.id));
    
    // Remove from recent notifications after 30 seconds
    setTimeout(() => {
      setRecentPackedNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderData.id);
        return newSet;
      });
    }, 30000);

    try {
      // Play the ringtone only if enabled
      if (ringtoneSettings.enabled) {
        playNotificationSound();
      }
      addDebugLog(`✅ Ringtone played successfully for packed order: ${orderData.id}`);
      
      // Show toast notification
      toast({
        title: "🎉 Order Ready for Pickup!",
        description: `Order for ${orderData.customer_name} is packed and ready for delivery`,
        duration: 5000,
      });
      addDebugLog(`✅ Toast notification shown for packed order: ${orderData.id}`);
    } catch (error) {
      addDebugLog(`❌ Error playing notification: ${error}`);
    }
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': { variant: 'secondary' as const, text: 'Pending', icon: Clock },
      'confirmed': { variant: 'default' as const, text: 'Confirmed', icon: CheckCircle },
      'preparing': { variant: 'secondary' as const, text: 'Preparing', icon: Package },
      'packed': { variant: 'default' as const, text: 'Ready for Pickup', icon: PackageOpen },
      'picked_up': { variant: 'secondary' as const, text: 'Out for Delivery', icon: Truck },
      'delivered': { variant: 'default' as const, text: 'Delivered', icon: CheckCircle },
      'cancelled': { variant: 'destructive' as const, text: 'Cancelled', icon: Clock }
    };

    return statusConfig[status as keyof typeof statusConfig] || { 
      variant: 'secondary' as const, 
      text: status.charAt(0).toUpperCase() + status.slice(1), 
      icon: Package 
    };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const isAuthorized = await checkSellerAuth();
      if (isAuthorized) {
        await fetchOrders();
      }
    };
    
    initialize();
  }, []);

  // Set up real-time subscription for order updates
  useEffect(() => {
    if (!sellerInfo) {
      addDebugLog('No seller info available, skipping subscription setup');
      return;
    }

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addDebugLog('No user found for subscription setup');
        return;
      }

      addDebugLog(`Setting up real-time subscription for seller orders (user: ${user.id})`);
      
      const channel = supabase
        .channel('seller-orders-debug')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            addDebugLog(`🆕 New order INSERT received: ${payload.new?.id || 'unknown'}`);
            addDebugLog(`   Customer: ${payload.new?.customer_name || 'unknown'}`);
            addDebugLog(`   Status: ${payload.new?.status || 'unknown'}`);
            addDebugLog(`   Total: ${payload.new?.total || 'unknown'}`);
            
            // Handle new order notifications
            if (payload.new) {
              addDebugLog(`🎯 New order detected - triggering notification`);
              handleNewOrderNotification(payload.new);
            }
            
            // Refresh orders
            fetchOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            addDebugLog(`📦 Order UPDATE received: ${payload.new?.id || 'unknown'}`);
            addDebugLog(`   Old Status: ${payload.old?.status || 'unknown'}`);
            addDebugLog(`   New Status: ${payload.new?.status || 'unknown'}`);
            
            // Handle packed order notifications
            if (payload.new && payload.new.status === 'packed' && payload.old?.status !== 'packed') {
              addDebugLog(`🎯 Status changed to 'packed' - triggering notification`);
              handlePackedOrderNotification(payload.new);
            } else if (payload.new?.status === 'packed') {
              addDebugLog(`ℹ️ Order already was 'packed', no notification needed`);
            } else {
              addDebugLog(`ℹ️ Status not 'packed', no notification needed`);
            }
            
            // Refresh orders
            fetchOrders();
          }
        )
        .subscribe((status) => {
          addDebugLog(`📡 Subscription status: ${status}`);
          setSubscriptionStatus(status);
        });

      return () => {
        addDebugLog('🔌 Cleaning up seller orders subscription');
        supabase.removeChannel(channel);
        setSubscriptionStatus('disconnected');
      };
    };

    const cleanup = setupSubscription();
    
    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, [sellerInfo]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-1/4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {sellerInfo?.business_name || sellerInfo?.name || 'Seller Dashboard'}
              </h1>
              <p className="text-sm text-gray-500">Manage your orders</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold text-gray-900">Your Orders</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                subscriptionStatus === 'SUBSCRIBED' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-xs text-gray-500">
                {subscriptionStatus === 'SUBSCRIBED' ? 'Live Updates' : 'Disconnected'}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            You'll hear a ringtone when orders are packed and ready for pickup
          </p>
          
          {/* Debug Panel */}
          {debugLogs.length > 0 && (
            <div className="bg-gray-100 rounded-lg p-3 mb-4">
              <div className="text-xs font-medium text-gray-700 mb-2">Debug Log:</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {debugLogs.map((log, index) => (
                  <div key={index} className="text-xs text-gray-600 font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-500">Your orders will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="space-y-4">
            {orders.map((order) => {
              const statusConfig = getStatusBadge(order.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <Card key={order.id} className="mb-4 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium">
                        Order #{order.id.substring(0, 8)}...
                      </CardTitle>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.text}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Customer Info */}
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">{order.customer_name}</span>
                        <span className="text-sm text-gray-500">• {order.customer_phone}</span>
                      </div>

                      {/* Order Value */}
                      <div className="flex items-center space-x-2">
                        <IndianRupee className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">{formatCurrency(order.total)}</span>
                        <Badge variant="outline" className="text-xs">
                          {Array.isArray(order.items) ? order.items.length : 0} items
                        </Badge>
                      </div>

                      {/* Order Time */}
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Special highlight for packed orders */}
                      {/* Mark as Packed Button */}
                      {(order.status === 'confirmed' || order.status === 'preparing') && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              addDebugLog(`📦 Marking order as packed: ${order.id}`);
                              const { data, error } = await supabase.functions.invoke('mark-order-as-packed', {
                                body: {
                                  order_id: order.id,
                                  marked_by: sellerInfo?.email || 'seller'
                                }
                              });

                              if (error) {
                                console.error('Error marking as packed:', error);
                                toast({
                                  title: "Error",
                                  description: "Failed to mark order as packed",
                                  variant: "destructive"
                                });
                              } else {
                                addDebugLog(`✅ Order marked as packed successfully: ${order.id}`);
                                toast({
                                  title: "Success",
                                  description: "Order marked as packed! Delivery agents notified.",
                                });
                              }
                            } catch (error) {
                              console.error('Exception:', error);
                              toast({
                                title: "Error",
                                description: "Failed to mark order as packed",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <PackageOpen className="h-4 w-4 mr-1" />
                          Mark as Packed
                        </Button>
                      )}
                      
                      {order.status === 'packed' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                          <div className="flex items-center space-x-2">
                            <Bell className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              Ready for pickup! Agent will collect soon.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;