import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { parseDeliverySlots } from "@/lib/deliverySlotParser";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAudioNotification, RingtoneSettings } from "@/hooks/useAudioNotification";
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
import { normalizeAddress } from "@/lib/utils";
import { debugAddress } from "@/lib/debugAddress";
import { calculateRealTimeDistance, getAgentLocationFromStorage, extractCoordinatesFromAddress } from "@/lib/distanceService";
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
  address: string; // Enforced as string to prevent React child errors
  original_address?: any; // Keep original address object for coordinate extraction
  items: any[];
  total: number;
  status: string;
  delivery_date: string;
  delivery_time?: string; // Actual delivery time from backend
  delivery_time_slot?: string; // Time slot from backend
  created_at: string;
  payment_status: string;
  coordinates?: { lat: number; lng: number };
  distance_km?: number;
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
}


const Home = () => {
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
  
  // Get current location with backend saving 
  const location = useGeolocation({
    enableHighAccuracy: true, // Use GPS for exact location
    timeout: 15000, // Longer timeout for GPS accuracy
    maximumAge: 60000, // Cache location for 1 minute
    saveToBackend: true,
    // Removed auto-refresh - only update location when manually triggered
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
  const [isLoadingDistance, setIsLoadingDistance] = useState<boolean>(false);
  const [agentName, setAgentName] = useState<string>("");
  const [sortBy, setSortBy] = useState<'nearest' | 'newest' | 'highest'>('nearest');
  const [recentNotifications, setRecentNotifications] = useState<Set<string>>(new Set());

  // Load agent settings on component mount
  useEffect(() => {
    loadAgentSettings();
  }, []);

  const loadAgentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get agent details
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
      console.error('Error loading agent settings:', error);
    }
  };

  // Check if a new order should trigger notification sound
  const shouldPlayNotificationForOrder = (orderData: any): boolean => {
    // Only play for orders that are available to accept (packed status, no agent assigned)
    if (orderData.status !== 'packed' || orderData.agent_id) {
      return false;
    }
    
    // Don't play duplicate notifications for the same order
    if (recentNotifications.has(orderData.id)) {
      return false;
    }
    
    return true;
  };

  // Check if order should trigger pickup notification for all agents
  const shouldPlayPickupNotificationForOrder = async (orderData: any): Promise<boolean> => {
    // Only play for orders that just changed to 'packed' status
    if (orderData.status !== 'packed') {
      return false;
    }
    
    console.log('🔔 Checking pickup notification for order:', orderData.id, 'Status:', orderData.status, 'Agent ID:', orderData.agent_id);
    
    // Don't play duplicate notifications for the same order
    if (recentNotifications.has(`pickup-${orderData.id}`)) {
      console.log('⚠️ Skipping duplicate pickup notification for order:', orderData.id);
      return false;
    }
    
    console.log('✅ Playing pickup notification for order:', orderData.id);
    return true;
  };

  // Handle new order notification with debouncing
  const handleNewOrderNotification = (orderData: any) => {
    if (!shouldPlayNotificationForOrder(orderData)) {
      return;
    }

    // Add to recent notifications to prevent duplicates
    setRecentNotifications(prev => new Set(prev).add(orderData.id));
    
    // Remove from recent notifications after 30 seconds
    setTimeout(() => {
      setRecentNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderData.id);
        return newSet;
      });
    }, 30000);

    // Play the ringtone only if enabled
    if (ringtoneSettings.enabled) {
      playNotificationSound();
    }
    
    // Show toast notification
    toast({
      title: "🔔 New Order Available!",
      description: `New delivery order from ${orderData.customer_name || 'customer'}`,
      duration: 4000,
    });
  };

  // Handle pickup ready notification for agent's accepted orders
  const handlePickupReadyNotification = async (orderData: any, oldOrderData: any) => {
    // Only notify if status changed from something else to 'packed'
    if (oldOrderData.status === 'packed' || !(await shouldPlayPickupNotificationForOrder(orderData))) {
      return;
    }

    // Add to recent notifications to prevent duplicates
    setRecentNotifications(prev => new Set(prev).add(`pickup-${orderData.id}`));
    
    // Remove from recent notifications after 30 seconds
    setTimeout(() => {
      setRecentNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(`pickup-${orderData.id}`);
        return newSet;
      });
    }, 30000);

    // Play the ringtone only if enabled
    if (ringtoneSettings.enabled) {
      playNotificationSound();
    }
    
    // Show toast notification
    toast({
      title: "📦 New Order Ready for Pickup!",
      description: `Order from ${orderData.customer_name || 'customer'} is packed and available for pickup`,
      duration: 5000,
    });
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
        setAgentName(agent.name);
      }
    } catch (error) {
      console.error('Error fetching agent name:', error);
    }
  };

  // Calculate real-time distances for all orders (shop to customer)
  const calculateOrderDistances = async (ordersList: Order[]) => {
    if (ordersList.length === 0) return ordersList;
    
    setIsLoadingDistance(true);
    console.log(`🔄 Calculating distances for ${ordersList.length} orders...`);
    
    const updatedOrders = await Promise.all(
      ordersList.map(async (order) => {
        try {
          // Extract pickup location (shop) coordinates
          const pickupCoords = order.pickup_location ? 
            { lat: order.pickup_location.lat, lng: order.pickup_location.lng } : null;
          
          // Extract customer delivery coordinates from original address object (before normalization)
          const customerCoords = extractCoordinatesFromAddress(order.original_address || order.address);
          
          if (!pickupCoords) {
            console.warn(`❌ Missing pickup coordinates for order ${order.id}:`, {
              order_id: order.id,
              pickup_location: order.pickup_location,
              pickup_address: order.pickup_address
            });
            return { ...order, distance_km: 2.5, eta_mins: 5, distance_source: 'fallback' as const };
          }
          
          if (!customerCoords) {
            console.warn(`❌ Missing customer coordinates for order ${order.id}:`, {
              order_id: order.id,
              customer_address: order.address,
              address_type: typeof order.address
            });
            return { ...order, distance_km: 2.5, eta_mins: 5, distance_source: 'fallback' as const };
          }

          // Calculate distance from shop to customer (actual delivery distance)
          const distanceResult = await calculateRealTimeDistance(
            pickupCoords,
            customerCoords,
            order.id
          );

          console.log('✅ Shop-to-customer distance calculated:', {
            orderId: order.id,
            pickup: pickupCoords,
            customer: customerCoords,
            distance: distanceResult.distance_km + 'km',
            eta: distanceResult.eta_mins + 'min',
            source: distanceResult.source
          });

          return {
            ...order,
            distance_km: distanceResult.distance_km,
            eta_mins: distanceResult.eta_mins,
            distance_source: distanceResult.source as 'realtime' | 'cached' | 'fallback'
          };
        } catch (error) {
          console.error(`❌ Error calculating distance for order ${order.id}:`, error);
          return { ...order, distance_km: 2.5, eta_mins: 5, distance_source: 'error' as const };
        }
      })
    );
    
    setIsLoadingDistance(false);
    console.log(`✅ Distance calculation completed for ${updatedOrders.length} orders`);
    return updatedOrders;
  };

  // Calculate agent payout - Match backend pricing structure
  const calculateAgentPayout = (distance: number): number => {
    // Base fare for first 3 km: ₹40
    const baseFare = 40;
    
    // Additional distance beyond 3 km
    const additionalDistance = Math.max(0, distance - 3);
    
    // Per km rate for additional distance: ₹9
    const perKmRate = 9;
    const distanceFare = additionalDistance * perKmRate;
    
    // Subtotal before platform fee
    const subtotal = baseFare + distanceFare;
    
    // Peak hour surge: 15% if current time is peak
    const isPeakHour = () => {
      const currentHour = new Date().getHours();
      const isWeekend = [0, 6].includes(new Date().getDay());
      const isLunchRush = currentHour >= 12 && currentHour < 14;
      const isDinnerRush = currentHour >= 19 && currentHour < 22;
      return isLunchRush || isDinnerRush || isWeekend;
    };
    
    const surgeAmount = isPeakHour() ? subtotal * 0.15 : 0;
    
    // Agent payout (total - platform fee of ₹13)
    const agentPayout = (subtotal + surgeAmount) - 13;
    
    return Math.max(12, Math.round(agentPayout * 100) / 100); // Minimum ₹12, round to 2 decimal places
  };

  // Get accurate payout from backend - Async function for data processing
  const updatePayoutFromBackend = async (distance: number, orderId?: string): Promise<number> => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-delivery-pricing', {
        body: {
          order_id: orderId,
          agent_location: location.latitude && location.longitude ? {
            lat: location.latitude,
            lng: location.longitude
          } : null
        }
      });

      if (!error && data?.success && typeof data?.agent_payout === 'number') {
        return Math.max(12, data.agent_payout); // Ensure minimum ₹12
      }
    } catch (error) {
      console.warn('Backend payout calculation failed:', error);
    }

    // Use frontend fallback (now matches backend structure)
    return calculateAgentPayout(distance);
  };

  // Transform and process order data
  const transformOrder = async (order: any, isAssigned: boolean = false): Promise<Order> => {
    // Keep original address object for coordinate extraction
    const originalAddress = order.address;
    const normalizedAddr = normalizeAddress(originalAddress);
    
    if (typeof normalizedAddr !== 'string') {
      console.error('❌ CRITICAL: Normalized address is not a string!', normalizedAddr);
    }
    
    console.log('🔍 Transform order - Original address:', originalAddress, 'Normalized:', normalizedAddr);

    let pickupLocation = order.pickup_location;
    let pickupAddress = order.pickup_address;
    let sellerName = order.seller_name;
    let sellerPhone = order.seller_phone;
    
    // If pickup location is missing for assigned orders, fetch from seller data
    if (isAssigned && !pickupLocation && order.items && order.items.length > 0) {
      const sellerId = order.items[0].seller_id;
      
      if (sellerId) {
        const { data: sellerData } = await supabase
          .from('sellers')
          .select('name, phone, latitude, longitude, address, business_name')
          .eq('user_id', sellerId)
          .single();
        
        if (sellerData && sellerData.latitude && sellerData.longitude) {
          pickupLocation = {
            lat: sellerData.latitude,
            lng: sellerData.longitude
          };
          pickupAddress = sellerData.address || sellerData.business_name || 'Pickup Location';
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
      original_address: originalAddress, // Keep original address for coordinate extraction
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
      // Improved delivery type logic based on actual backend fields
      delivery_type: (() => {
        // Priority 1: Subscription orders
        if (order.subscription_id) return 'scheduled';
        
        // Priority 2: Orders with delivery time slots (scheduled)
        if (order.delivery_time_slot) return 'scheduled';
        
        // Priority 3: Orders with specific delivery time (not immediate)
        if (order.delivery_time && order.delivery_time !== 'Immediate') return 'scheduled';
        
        // Priority 4: Book now pay later orders (future delivery date)
        if (order.payment_status === 'Pending' && 
            order.delivery_date && 
            order.delivery_date !== new Date().toISOString().split('T')[0]) {
          return 'book_now_pay_later';
        }
        
        // Default: Immediate delivery
        return 'immediate';
      })(),
      order_placed_at: new Date(order.created_at),
      agent_payout: order.agent_payout || undefined,
      estimated_time_minutes: order.estimated_time_minutes || undefined,
      subscription_id: order.subscription_id || undefined,
      
      delivery_slots: parseDeliverySlots(order),
      pickup_location: pickupLocation,
      pickup_address: pickupAddress,
      seller_phone: sellerPhone,
      seller_name: sellerName
    };
  };

  // Unified fetch orders function with deduplication
  const fetchOrdersData = async (showLoading: boolean = false): Promise<Order[]> => {
    if (showLoading) setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return [];
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) return [];

      // Fetch both available and assigned orders in parallel
      const [availableResponse, assignedResponse] = await Promise.all([
        supabase.functions.invoke('get-available-orders', {
          body: { agent_id: agent.id }
        }),
        supabase
          .from('orders')
          .select('*')
          .eq('agent_id', agent.id)
          .in('status', ['assigned', 'picked_up', 'in_transit'])
          .order('created_at', { ascending: false })
      ]);

      if (availableResponse.error) throw availableResponse.error;
      if (assignedResponse.error) throw assignedResponse.error;

      // Transform orders
      const availableOrders = await Promise.all(
        (availableResponse.data?.orders || []).map((order: any) => transformOrder(order, false))
      );
      
      const assignedOrders = await Promise.all(
        (assignedResponse.data || []).map((order: any) => transformOrder(order, true))
      );

      // Combine and deduplicate orders by ID
      const orderMap = new Map<string, Order>();
      
      // Add available orders first
      availableOrders.forEach(order => {
        orderMap.set(order.id, order);
      });
      
      // Add assigned orders (will override available ones if duplicate)
      assignedOrders.forEach(order => {
        orderMap.set(order.id, order);
      });

      const deduplicatedOrders = Array.from(orderMap.values());
      console.log(`📊 Orders processed: ${availableOrders.length} available, ${assignedOrders.length} assigned, ${deduplicatedOrders.length} total after deduplication`);
      
      return deduplicatedOrders;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // Fetch orders with loading state
  const fetchOrders = async () => {
    try {
      const orders = await fetchOrdersData(true);
      setOrders(orders);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch orders. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Fetch orders for refresh without loading state
  const fetchOrdersForRefresh = async () => {
    try {
      const orders = await fetchOrdersData(false);
      setOrders(orders);
      
      // Calculate distances for refreshed orders if we have location
      if (orders.length > 0 && location.latitude && location.longitude) {
        console.log('🔄 Orders refreshed, recalculating distances...');
        const ordersWithDistance = await calculateOrderDistances(orders);
        setOrders(ordersWithDistance);
      }
    } catch (error) {
      console.error('Error refreshing orders:', error);
      // Don't show error toast for background refresh
    }
  };

  // Pull to refresh functionality
  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent multiple clicks
    
    setIsRefreshing(true);
    try {
      await fetchOrdersForRefresh();
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

      const { data, error } = await supabase.functions.invoke('accept-order', {
        body: { order_id: orderId, agent_id: agent.id }
      });

      if (error) {
        console.error('Error accepting order:', error);
        toast({
          title: "Error",
          description: "Failed to accept order. Please try again.",
          variant: "destructive"
        });
      } else if (data?.success) {
        toast({
          title: "Success",
          description: "Order accepted successfully!",
        });
        
        // Refresh orders to show updated state with pickup location
        await fetchOrders();
      }
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

  // Track previous location to prevent unnecessary refreshes
  const [lastLocationRefresh, setLastLocationRefresh] = useState<{lat: number, lng: number} | null>(null);
  const [lastDistanceCalculation, setLastDistanceCalculation] = useState<{lat: number, lng: number} | null>(null);

  // Auto-update location when geolocation data is available
  useEffect(() => {
    if (location.address) {
      setCurrentLocation(location.address);
    } else if (location.latitude && location.longitude) {
      setCurrentLocation(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    }
    
    // Only refresh orders when location changes significantly (more than 500m)
    if (location.latitude && location.longitude) {
      const currentPos = { lat: location.latitude, lng: location.longitude };
      
      if (!lastLocationRefresh) {
        setLastLocationRefresh(currentPos);
        fetchOrders();
      } else {
        // Calculate distance between current and last refresh position
        const distance = Math.sqrt(
          Math.pow(currentPos.lat - lastLocationRefresh.lat, 2) + 
          Math.pow(currentPos.lng - lastLocationRefresh.lng, 2)
        ) * 111000; // Rough conversion to meters
        
        // Only refresh if moved more than 500 meters
        if (distance > 500) {
          setLastLocationRefresh(currentPos);
          fetchOrders();
        }
      }
      
      // Recalculate distances when location changes significantly (more than 100m)
      if (orders.length > 0) {
        if (!lastDistanceCalculation) {
          setLastDistanceCalculation(currentPos);
          console.log('🎯 Initial location set, calculating distances...');
          calculateOrderDistances(orders).then(setOrders);
        } else {
          const distanceChange = Math.sqrt(
            Math.pow(currentPos.lat - lastDistanceCalculation.lat, 2) + 
            Math.pow(currentPos.lng - lastDistanceCalculation.lng, 2)
          ) * 111000; // Rough conversion to meters
          
          // Recalculate distances if moved more than 100 meters
          if (distanceChange > 100) {
            setLastDistanceCalculation(currentPos);
            console.log('📍 Location changed significantly, recalculating distances...');
            calculateOrderDistances(orders).then(setOrders);
          }
        }
      }
    }
  }, [location.address, location.latitude, location.longitude, orders.length]);

  // Set up real-time subscription for order updates
  useEffect(() => {
    console.log('🔧 Setting up real-time subscription for orders...');
    
    const channel = supabase
      .channel('orders-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('📝 Order updated:', payload);
          
          // Handle pickup ready notification for agent's accepted orders
          if (payload.new && payload.old && payload.new.status !== payload.old.status) {
            console.log(`🔄 Order status changed: ${payload.old.status} → ${payload.new.status}`);
            
            // Check if this is an agent's order becoming ready for pickup
            if (payload.new.status === 'packed' && payload.old.status !== 'packed') {
              handlePickupReadyNotification(payload.new, payload.old);
            }
            
            fetchOrdersForRefresh();
          }
          
          // Also refresh if agent assignment changes
          if (payload.new && payload.old && payload.new.agent_id !== payload.old.agent_id) {
            console.log('👤 Agent assignment changed, refreshing...');
            fetchOrdersForRefresh();
          }

          // Refresh payout when order distance or other payout-affecting fields change
          if (payload.new && payload.old && 
              (payload.new.distance_km !== payload.old.distance_km || 
               payload.new.agent_payout !== payload.old.agent_payout)) {
            console.log('💰 Order payout data changed, refreshing...');
            fetchOrdersForRefresh();
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
          console.log('🆕 New order created:', payload);
          
          // Handle notification for new available orders
          if (payload.new) {
            handleNewOrderNotification(payload.new);
          }
          
          fetchOrdersForRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'earnings'
        },
        (payload) => {
          console.log('💰 Earnings updated:', payload);
          // Refresh orders to show updated payout information
          fetchOrdersForRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payout_config'  
        },
        (payload) => {
          console.log('⚙️ Payout configuration updated:', payload);
          // Refresh orders to recalculate payouts with new rates
          fetchOrdersForRefresh();
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to orders, earnings, and payout config real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
        }
      });

    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  // Trigger distance calculation when orders are initially loaded (only once per order set)
  useEffect(() => {
    if (orders.length > 0 && !isLoadingDistance && location.latitude && location.longitude) {
      // Check if these orders already have distance calculations
      const ordersNeedingDistance = orders.filter(order => 
        order.distance_km === undefined || order.distance_source === undefined
      );
      
      if (ordersNeedingDistance.length > 0) {
        console.log(`🔄 ${ordersNeedingDistance.length} orders need distance calculation...`);
        calculateOrderDistances(orders).then(async (updatedOrders) => {
          // Calculate accurate payouts using backend for updated distances
          const ordersWithPayouts = await Promise.all(
            updatedOrders.map(async (order) => {
              const backendPayout = await updatePayoutFromBackend(order.distance_km || 2.5, order.id);
              return {
                ...order,
                agent_payout: backendPayout // Always update with fresh calculation
              };
            })
          );
          setOrders(ordersWithPayouts);
        });
      }
    }
  }, [orders.length, location.latitude, location.longitude]); // Trigger when new orders are loaded or location is available

  // Real-time distance and payout updates - recalculate every 30 seconds for active orders
  useEffect(() => {
    if (orders.length === 0 || !location.latitude || !location.longitude) return;
    
    const updateDistancesAndPayouts = async () => {
      console.log('🔄 Updating real-time distances and payouts...');
      const updatedOrders = await calculateOrderDistances(orders);
      
      // Recalculate payouts using backend for all orders with updated distances
      const ordersWithUpdatedPayouts = await Promise.all(
        updatedOrders.map(async (order) => {
          const backendPayout = await updatePayoutFromBackend(order.distance_km || 2.5, order.id);
          return {
            ...order,
            agent_payout: backendPayout // Always refresh payout calculation
          };
        })
      );
      
      setOrders(ordersWithUpdatedPayouts);
    };

    // Initial calculation
    updateDistancesAndPayouts();
    
    // Set up interval for real-time updates every 30 seconds
    const interval = setInterval(updateDistancesAndPayouts, 30000);
    
    return () => clearInterval(interval);
  }, [location.latitude, location.longitude]); // Recalculate when agent location changes

  useEffect(() => {
    fetchAgentName();
    fetchOrders();
    
    // Backup refresh interval - every 5 minutes
    const interval = setInterval(fetchOrders, 300000);
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
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header with Greeting */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Zaago Delivery Agent</h1>
            <div className="flex items-center text-xs text-gray-500 mt-1 cursor-pointer hover:text-gray-700 transition-colors" onClick={() => setShowLocationPicker(true)}>
              <MapPin className="w-3 h-3 mr-1 text-red-500" />
              <span className="truncate max-w-[280px]">{currentLocation}</span>
            </div>
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
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'nearest' | 'newest' | 'highest')}>
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
                  No delivery requests available within 15km radius
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
                                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center cursor-pointer transition-colors border-l-4 border-green-300"
                               onClick={async () => {
                                 if (order.pickup_location) {
                                   const { lat, lng } = order.pickup_location;
                                   const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                                   window.open(googleMapsUrl, '_blank');
                                 } else if (order.pickup_address) {
                                    const safePickupAddress = typeof order.pickup_address === 'string' ? order.pickup_address : JSON.stringify(order.pickup_address);
                                    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(safePickupAddress)}&travelmode=driving`;
                                   window.open(googleMapsUrl, '_blank');
                                 } else {
                                   // Try to fetch seller location if missing
                                   try {
                                     if (order.items && order.items.length > 0) {
                                       const sellerId = order.items[0].seller_id;
                                       
                                       if (sellerId) {
                                         const { data: sellerData } = await supabase
                                           .from('sellers')
                                           .select('name, phone, latitude, longitude, address, business_name')
                                           .eq('user_id', sellerId)
                                           .single();
                                         
                                         if (sellerData && sellerData.latitude && sellerData.longitude) {
                                           const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${sellerData.latitude},${sellerData.longitude}&travelmode=driving`;
                                           window.open(googleMapsUrl, '_blank');
                                           return;
                                         }
                                       }
                                     }
                                   } catch (error) {
                                     console.error('Error fetching seller location:', error);
                                   }
                                   
                                   toast({
                                     title: "Pickup Location Issue",
                                     description: "Unable to get pickup location. Please contact support or check seller details.",
                                     variant: "destructive",
                                   });
                                 }
                               }}
                              >
                                <MapPin className="w-4 h-4 mr-2" />
                                <div className="flex items-center">
                                  <span className="text-sm font-medium">Pick Up</span>
                                </div>
                             </div>
                           )}
                        </div>

                         {/* Delivery Timer */}
                         <div className="mb-4">
                            <DeliveryTimer
                              deliveryType={order.delivery_type}
                              scheduledTime={order.delivery_time}
                              orderPlacedAt={order.order_placed_at}
                              subscriptionId={order.subscription_id}
                              deliveryTime={order.delivery_time}
                              deliverySlots={order.delivery_slots}
                              paymentStatus={order.payment_status}
                            />
                         </div>

                        {/* Address */}
                        <div className="flex items-start mb-4">
                          <MapPin className="w-4 h-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
                          <div className="flex-1">
                               <div 
                                 className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center cursor-pointer transition-colors inline-flex"
                                 onClick={() => {
                                   const address = debugAddress(order.address, `order-${order.id}-maps`);
                                   const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
                                   window.open(googleMapsUrl, '_blank');
                                 }}
                               >
                                 <MapPin className="w-4 h-4 mr-2" />
                                 <span className="text-sm font-medium">Delivery Address</span>
                               </div>
                          </div>
                        </div>

                        {/* Order Stats */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <Navigation className="w-4 h-4 text-green-500 mr-1" />
                              <span className="text-sm font-medium text-gray-700 flex items-center" title="Real-time delivery distance from shop to customer">
                                {isLoadingDistance ? (
                                  <div className="flex items-center">
                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    <span className="text-xs text-gray-500">Updating...</span>
                                  </div>
                                ) : (
                                   <div className="flex items-center">
                                     <span>{`${order.distance_km ? order.distance_km.toFixed(1) : '2.5'} km delivery`}</span>
                                     <div className="w-2 h-2 bg-green-400 rounded-full ml-1 animate-pulse" title="Real-time tracking"></div>
                                   </div>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center">
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <IndianRupee className="w-4 h-4 text-green-600 mr-1" />
                              <span className="text-sm text-green-800">Agent payout: </span>
                              <span className="text-sm font-bold text-green-800" title="Real-time payout based on current distance">
                                ₹{calculateAgentPayout(order.distance_km || 2.5)}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-xs text-green-700 font-medium flex items-center">
                                {isLoadingDistance ? (
                                  <div className="flex items-center">
                                    <Loader2 className="w-2 h-2 animate-spin mr-1" />
                                    <span>Updating...</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    {order.distance_km && (
                                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1 animate-pulse" title="Real-time tracking"></div>
                                    )}
                                  </div>
                                )}
                              </span>
                            </div>
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
