import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAudioNotification } from "@/hooks/useAudioNotification";
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
  const { playNotificationSound } = useAudioNotification();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [recentPackedNotifications, setRecentPackedNotifications] = useState<Set<string>>(new Set());

  // Check if user is authenticated seller
  const checkSellerAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return false;
      }

      // Check if user is a seller
      const { data: seller } = await supabase
        .from('sellers')
        .select('*')
        .eq('user_id', user.id)
        .eq('approval_status', 'approved')
        .single();

      if (!seller) {
        toast({
          title: "Access Denied",
          description: "You don't have seller access or your account is not approved.",
          variant: "destructive",
        });
        navigate('/');
        return false;
      }

      setSellerInfo(seller);
      return true;
    } catch (error) {
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

  // Handle new packed order notification
  const handlePackedOrderNotification = (orderData: any) => {
    // Only play for orders that just got packed and haven't been notified recently
    if (orderData.status !== 'packed' || recentPackedNotifications.has(orderData.id)) {
      return;
    }

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

    // Play the ringtone
    playNotificationSound();
    
    // Show toast notification
    toast({
      title: "🎉 Order Ready for Pickup!",
      description: `Order for ${orderData.customer_name} is packed and ready for delivery`,
      duration: 5000,
    });
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
    if (!sellerInfo) return;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔗 Setting up real-time subscription for seller orders...');
      
      const channel = supabase
        .channel('seller-orders')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📦 Order updated:', payload);
            
            // Handle packed order notifications
            if (payload.new && payload.new.status === 'packed' && payload.old?.status !== 'packed') {
              handlePackedOrderNotification(payload.new);
            }
            
            // Refresh orders
            fetchOrders();
          }
        )
        .subscribe((status) => {
          console.log('📡 Real-time subscription status:', status);
        });

      return () => {
        console.log('🔌 Cleaning up seller orders subscription');
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your Orders</h2>
          <p className="text-sm text-gray-600">
            You'll hear a ringtone when orders are packed and ready for pickup
          </p>
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