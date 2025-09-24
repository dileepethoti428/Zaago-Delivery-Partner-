import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAudioNotification } from "@/hooks/useAudioNotification";
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
  ChevronDown,
  UserCheck
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { LocationPicker } from "@/components/LocationPicker";
import DeliveryTimer from "@/components/DeliveryTimer";

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
}


const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playNotificationSound } = useAudioNotification();
  
  // Get current location with backend saving 
  const location = useGeolocation({
    enableHighAccuracy: true, // Use GPS for exact location
    timeout: 15000, // Longer timeout for GPS accuracy
    maximumAge: 10000, // Fresh location data
    saveToBackend: true,
    refreshInterval: 30000, // Auto-refresh every 30 seconds for exact location
  });
  
  // State management
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notificationCount] = useState(3);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('Tap to set location');
  const [locationPickerTrigger, setLocationPickerTrigger] = useState<HTMLButtonElement | null>(null);
  const [ordersWithDistance, setOrdersWithDistance] = useState<Order[]>([]);
  const [acceptingOrders, setAcceptingOrders] = useState<Record<string, boolean>>({});
  const [rejectingOrders, setRejectingOrders] = useState<Record<string, boolean>>({});
  const [agentName, setAgentName] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("nearest");

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
        setAgentName(agent.name);
      }
    } catch (error) {
      console.error('Error fetching agent name:', error);
    }
  };

  // Calculate agent payout (simple calculation)
  const calculateAgentPayout = (distance: number) => {
    const basePay = 20;
    const additionalDistance = Math.max(0, distance - 1);
    const perKmRate = 15;
    const distancePay = additionalDistance * perKmRate;
    
    return basePay + distancePay;
  };

  // Fetch orders from backend
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) return;

      const { data: availableResponse, error: availableError } = await supabase.functions.invoke('get-available-orders', {
        body: { agent_id: agent.id }
      });

      if (availableError) throw availableError;

      const { data: assignedOrders, error: assignedError } = await supabase
        .from('orders')
        .select('*')
        .eq('agent_id', agent.id)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        .order('created_at', { ascending: false });

      if (assignedError) throw assignedError;

      const transformedAvailableOrders: Order[] = (availableResponse?.orders || []).map((order: any) => ({
        ...order,
        order_placed_at: new Date(order.created_at),
        delivery_type: order.subscription_id || order.delivery_time_slot ? 'scheduled' : 'immediate'
      }));

      const transformedAssignedOrders: Order[] = (assignedOrders || []).map((order: any) => ({
        id: order.id,
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        address: order.address,
        items: Array.isArray(order.items) ? order.items : [],
        total: order.total || 0,
        status: order.status,
        delivery_date: order.delivery_date || '',
        created_at: order.created_at,
        payment_status: order.payment_status || '',
        coordinates: order.coordinates || undefined,
        distance_km: order.distance_km || undefined,
        delivery_time: order.delivery_time || undefined,
        products_count: Array.isArray(order.items) ? order.items.length : 1,
        restaurant: order.restaurant || undefined,
        backend_calculated: false,
        delivery_type: order.subscription_id || order.delivery_time_slot ? 'scheduled' : 'immediate',
        scheduled_time: order.scheduled_time || undefined,
        order_placed_at: new Date(order.created_at),
        agent_payout: order.agent_payout || undefined,
        estimated_time_minutes: order.estimated_time_minutes || undefined,
        subscription_id: order.subscription_id || undefined,
        delivery_slots: order.delivery_slots || undefined,
        pickup_location: order.pickup_location || undefined,
        pickup_address: order.pickup_address || undefined,
        seller_phone: order.seller_phone || undefined,
        seller_name: order.seller_name || undefined
      }));

      const allOrders = [...transformedAvailableOrders, ...transformedAssignedOrders];
      setOrders(allOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Pull to refresh functionality
  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent multiple clicks
    
    setIsRefreshing(true);
    try {
      await fetchOrders();
      toast({
        title: "Orders Updated",
        description: "Your order list has been refreshed.",
      });
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast({
        title: "Refresh Failed",
        description: "Could not refresh orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Accept order
  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingOrders(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) return;

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'assigned', 
          agent_id: agent.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('status', 'packed');

      if (error) throw error;

      toast({
        title: "Order Accepted!",
        description: "You have successfully accepted this order.",
      });

      await fetchOrders();
    } catch (error) {
      console.error('Error accepting order:', error);
      toast({
        title: "Error",
        description: "Failed to accept order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAcceptingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Reject order
  const handleRejectOrder = async (orderId: string) => {
    setRejectingOrders(prev => ({ ...prev, [orderId]: true }));
    
    try {
      // Add order to rejected list or handle rejection logic
      toast({
        title: "Order Rejected",
        description: "Order has been rejected and removed from your list.",
      });
      
      setOrders(prev => prev.filter(order => order.id !== orderId));
    } catch (error) {
      console.error('Error rejecting order:', error);
    } finally {
      setRejectingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Sort orders based on selected criteria
  const getSortedOrders = (orders: Order[]) => {
    return [...orders].sort((a, b) => {
      switch (sortBy) {
        case 'nearest':
          return (a.distance_km || 999) - (b.distance_km || 999);
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'highest':
          return b.total - a.total;
        default:
          return 0;
      }
    });
  };

  const availableOrders = getSortedOrders(orders);
  const assignedOrders = availableOrders.filter(order => order.status === 'assigned');

  // Auto-update location when geolocation data is available
  useEffect(() => {
    if (location.address) {
      setCurrentLocation(location.address);
    } else if (location.latitude && location.longitude) {
      setCurrentLocation(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    }
    
    // Refresh orders when location changes significantly
    if (location.latitude && location.longitude) {
      fetchOrders();
    }
  }, [location.address, location.latitude, location.longitude]);

  useEffect(() => {
    fetchAgentName();
    fetchOrders();
    
    // More frequent order refresh for better real-time updates
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  // Trigger location picker when showLocationPicker changes
  useEffect(() => {
    if (showLocationPicker && locationPickerTrigger) {
      locationPickerTrigger.click();
      setShowLocationPicker(false);
    }
  }, [showLocationPicker, locationPickerTrigger]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-28 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="flex space-x-2">
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="px-4 py-4 bg-gray-50">
          <div className="grid grid-cols-3 gap-3">
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
            <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Orders Header Skeleton */}
        <div className="px-4 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-1"></div>
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-9 w-36 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>

        {/* Order Cards Skeleton */}
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-200">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-1"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
                </div>
                
                {/* Timer */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="h-16 w-full bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Address */}
                <div className="flex items-start">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse mr-2 mt-1"></div>
                  <div className="flex-1">
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-1"></div>
                    <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex space-x-4">
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Payout */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Buttons */}
                <div className="flex space-x-3">
                  <div className="flex-1 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="flex-1 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Greeting */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Zaago Delivery Agent</h1>
            <div className="flex items-center text-xs text-gray-500 mt-1 cursor-pointer hover:text-gray-700 transition-colors" onClick={() => setShowLocationPicker(true)}>
              <MapPin className="w-3 h-3 mr-1 text-red-500" />
              <span className="truncate max-w-[280px]">{currentLocation}</span>
            </div>
            {location.latitude && location.longitude && (
              <div className="text-xs text-gray-400 mt-1">
                <span className="font-mono">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </span>
                {location.accuracy && (
                  <span className="ml-2">±{Math.round(location.accuracy)}m</span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Notification Bell */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/notifications')}
                className="hover:bg-gray-100"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {notificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-medium">{notificationCount}</span>
                  </div>
                )}
              </Button>
            </div>
            
            {/* Profile Button */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="hover:bg-gray-100"
            >
              <User className="w-5 h-5 text-gray-600" />
            </Button>
          </div>
        </div>
      </div>

      {/* Greeting Section */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">
          {getGreeting()}{agentName ? `, ${capitalizeWords(agentName)}!` : '!'}
        </h2>
        <p className="text-sm text-gray-600 italic mt-1">
          "Ready to deliver excellence today"
        </p>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-4 bg-gray-50">
        <div className="grid grid-cols-3 gap-3">
          {/* Go Online/Offline Button */}
          <Button
            onClick={() => setIsOnline(!isOnline)}
            className={`h-12 rounded-lg font-medium ${
              isOnline 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </Button>

          {/* Refresh Orders */}
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="h-12 rounded-lg border-gray-300 text-gray-700 hover:bg-gray-100 bg-white"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 animate-spin text-gray-700 mr-1" />
                <span className="text-xs text-gray-700">Refresh</span>
              </div>
            ) : (
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 text-gray-700 mr-1" />
                <span className="text-xs text-gray-700">Refresh</span>
              </div>
            )}
          </Button>

          {/* QR Scanner */}
          <Button
            onClick={() => setShowQrScanner(true)}
            variant="outline"
            className="h-12 rounded-lg border-gray-300 text-gray-700 hover:bg-gray-100 bg-white"
          >
            <div className="flex items-center">
              <QrCode className="w-4 h-4 text-gray-700 mr-1" />
              <span className="text-xs text-gray-700">QR</span>
            </div>
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-gray-50">
        {/* Orders Header */}
        <div className="px-4 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Orders ({availableOrders.length})</h2>
              <p className="text-sm text-gray-500">Available orders and your assignments</p>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36 h-9 border-gray-300 bg-white">
                <SelectValue className="text-gray-700" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="nearest" className="text-gray-700">
                  <div className="flex items-center">
                    <Target className="w-4 h-4 mr-2 text-green-500" />
                    <span className="text-gray-700">Nearest First</span>
                  </div>
                </SelectItem>
                <SelectItem value="newest" className="text-gray-700">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-gray-700" />
                    <span className="text-gray-700">Newest First</span>
                  </div>
                </SelectItem>
                <SelectItem value="highest" className="text-gray-700">
                  <div className="flex items-center">
                    <IndianRupee className="w-4 h-4 mr-2 text-gray-700" />
                    <span className="text-gray-700">Highest First</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {availableOrders.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
                  <PackageOpen className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders available</h3>
                <p className="text-gray-500 mb-4">
                  Check back later for new delivery opportunities
                </p>
                {!isOnline && (
                  <Button
                    onClick={() => setIsOnline(true)}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Go Online
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {availableOrders.map((order, index) => {
                  return (
                     <div 
                       key={order.id} 
                       className={`bg-white rounded-2xl p-4 border border-gray-200 ${
                         order.status === 'assigned' ? 'border-green-200 bg-green-50' : ''
                       }`}
                     >
                        {/* Order Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">{order.customer_name}</h3>
                            <p className="text-sm text-gray-500">
                              {order.seller_name || 'Restaurant'} • Order #{order.id.substring(0, 8)}...
                            </p>
                          </div>
                          {/* Pickup Location */}
                          {order.status === 'assigned' && (
                            <div 
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center cursor-pointer transition-colors"
                              onClick={() => {
                                if (order.pickup_location) {
                                  const { lat, lng } = order.pickup_location;
                                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                                  window.open(googleMapsUrl, '_blank');
                                } else if (order.pickup_address) {
                                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.pickup_address)}&travelmode=driving`;
                                  window.open(googleMapsUrl, '_blank');
                                } else {
                                  toast({
                                    title: "Location Not Available",
                                    description: "Pickup location information is not available for this order.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <MapPin className="w-3 h-3 mr-1" />
                              {order.pickup_address 
                                ? order.pickup_address.length > 25 
                                  ? `${order.pickup_address.substring(0, 25)}...` 
                                  : order.pickup_address
                                : order.pickup_location 
                                  ? `${order.pickup_location.lat.toFixed(4)}, ${order.pickup_location.lng.toFixed(4)}`
                                  : 'Pickup Location'
                              }
                            </div>
                          )}
                        </div>

                        {/* Delivery Timer */}
                        {(() => {
                          const isScheduledOrder = Boolean(
                            order.subscription_id || 
                            order.delivery_slots ||
                            order.scheduled_time ||
                            (order.delivery_date && order.delivery_date !== new Date().toISOString().split('T')[0])
                          );
                          
                          return isScheduledOrder ? (
                            <div className="mb-4">
                              <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="bg-blue-100 p-2 rounded-lg mr-3">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-blue-900 font-medium">Scheduled Delivery</p>
                                    <p className="text-xs text-blue-700">Arrives at</p>
                                  </div>
                                </div>
                                <div className="bg-blue-200 px-3 py-1 rounded-full">
                                  <span className="text-xs text-blue-800 font-medium">Scheduled</span>
                                </div>
                              </div>
                              
                              <div className="bg-blue-100 p-4 rounded-lg mt-2 text-center">
                                <div className="text-2xl font-bold text-blue-600 mb-1">
                                  {order.delivery_time || '12:00 PM'}
                                </div>
                                <div className="text-sm text-blue-700">
                                  {order.delivery_date === new Date().toISOString().split('T')[0] ? 'Today' : 'Tomorrow'}
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Address */}
                        <div className="flex items-start mb-4">
                          <MapPin className="w-4 h-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {(() => {
                                if (typeof order.address === 'string') return order.address;
                                if (order.address?.full_address) return order.address.full_address;
                                if (order.address?.addressLine1) return `${order.address.addressLine1}, ${order.address.city || ''}`;
                                return 'Address not available';
                              })()}
                            </p>
                          </div>
                        </div>

                        {/* Order Stats */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <Navigation className="w-4 h-4 text-green-500 mr-1" />
                              <span className="text-sm font-medium text-gray-700">
                                {order.distance_km ? `${order.distance_km} km` : '2.5 km'}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 text-gray-500 mr-1" />
                              <span className="text-sm text-gray-600">
                                {order.estimated_time_minutes ? `${order.estimated_time_minutes} min` : '5 min'}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Package className="w-4 h-4 text-gray-500 mr-1" />
                              <span className="text-sm text-gray-600">
                                {Array.isArray(order.items) ? order.items.length : 1} products
                              </span>
                            </div>
                            <div className="flex items-center">
                              <IndianRupee className="w-4 h-4 text-gray-900 mr-1" />
                              <span className="text-sm font-medium text-gray-900">
                                ₹{order.total}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Agent Payout */}
                        <div className="bg-green-50 p-3 rounded-lg mb-4">
                          <div className="flex items-center">
                            <IndianRupee className="w-4 h-4 text-green-600 mr-1" />
                            <span className="text-sm text-green-800">Agent payout: </span>
                            <span className="text-sm font-bold text-green-800">
                              ₹{order.agent_payout || calculateAgentPayout(order.distance_km || 2.5)}
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        {order.status === 'assigned' ? (
                          <Button 
                            onClick={() => navigate(`/delivery-details/${order.id}`)}
                            className="w-full bg-green-500 hover:bg-green-600 text-white h-12 rounded-lg font-medium flex items-center justify-center"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Manage Delivery
                          </Button>
                        ) : (
                          <div className="flex space-x-3">
                            <Button 
                              onClick={() => handleAcceptOrder(order.id)}
                              className="flex-1 bg-green-500 hover:bg-green-600 text-white h-12 rounded-lg font-medium"
                              disabled={acceptingOrders[order.id]}
                            >
                              {acceptingOrders[order.id] ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                              className="flex-1 border-gray-300 text-gray-700 hover:bg-white hover:border-gray-400 h-12 rounded-lg font-medium bg-white"
                              disabled={rejectingOrders[order.id]}
                            >
                              {rejectingOrders[order.id] ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                     </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* QR Scanner Dialog */}
      <QrScannerDialog 
        open={showQrScanner} 
        onOpenChange={setShowQrScanner} 
      />

      {/* Location Picker - Hidden trigger */}
      <LocationPicker
        onLocationSelected={(locationData) => {
          setCurrentLocation(locationData.address || 'Location selected');
          toast({
            title: "Location Updated",
            description: "Your delivery location has been updated successfully.",
          });
        }}
      >
        <button 
          ref={setLocationPickerTrigger}
          style={{ display: 'none' }}
        />
      </LocationPicker>
    </div>
  );
};

export default Home;
