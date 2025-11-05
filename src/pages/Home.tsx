import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, memo } from "react";
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
import { useWakeLock } from "@/hooks/useWakeLock";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useOptimizedDistances } from "@/hooks/useOptimizedDistances";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
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
import { normalizeAddress } from "@/lib/utils";
import { debugAddress } from "@/lib/debugAddress";
import { calculateRealTimeDistance, getAgentLocationFromStorage, extractCoordinatesFromAddress } from "@/lib/distanceService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DeliveryTimer from "@/components/DeliveryTimer";
import { OfflineCompletionsQueue } from "@/components/OfflineCompletionsQueue";
import { OrderCard } from "@/components/OrderCard";

// Lazy load heavy components
const LocationPicker = lazy(() => import("@/components/LocationPicker").then(m => ({ default: m.LocationPicker })));

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
  agent_to_shop_distance?: number; // Real-time distance from agent to pickup shop for "Nearest First" sorting
  total_distance?: number; // Total distance (agent to shop + shop to customer)
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
  
  // Backend classification fields
  calculated_delivery_type?: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later';
  immediate_timing_config?: {
    max_duration_minutes: number;
    time_slot_start: string;
    time_slot_end: string;
    slot_name: string;
  };
  original_created_at?: string;
}


const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Load ringtone settings from database for agent
  const [ringtoneSettings, setRingtoneSettings] = useState<RingtoneSettings>({
    enabled: true,
    volume: 0.8,
    type: 'iphone-6-ringtone',
    frequency: 'double'
  });
  
  const { playNotificationSound, testRingtone, stopRingtone } = useAudioNotification(ringtoneSettings);
  
  // Get current location with backend saving - optimized for faster loading
  const location = useGeolocation({
    enableHighAccuracy: false, // Use network location first for speed
    timeout: 8000, // Reduced timeout for faster loading
    maximumAge: 300000, // Cache location for 5 minutes
    saveToBackend: true,
    // Removed auto-refresh - only update location when manually triggered
  });
  
  // State management
  const [isOnline, setIsOnline] = useState(false);
  
  // Use wake lock to keep app active in background when online
  const { isActive: isWakeLockActive } = useWakeLock(isOnline);
  // Initialize agent state BEFORE using it in hooks - synchronously from cache
  const getCachedAgent = () => {
    const cachedAgentId = sessionStorage.getItem('agentId');
    const cachedAgentName = sessionStorage.getItem('agentName');
    return cachedAgentId ? { id: cachedAgentId, name: cachedAgentName || '' } : null;
  };
  
  const cachedAgentData = getCachedAgent();
  const [agent, setAgent] = useState<{ id: string } | null>(cachedAgentData);
  const [isAgentInitialized, setIsAgentInitialized] = useState(!!cachedAgentData);
  
  // Initialize agent immediately on mount - fetch from DB if not cached
  useEffect(() => {
    // Skip if already initialized from cache
    if (isAgentInitialized && agent) {
      console.log('✅ Using cached agent data:', agent);
      if (cachedAgentData?.name) {
        setAgentName(cachedAgentData.name);
      }
      return;
    }
    
    const initAgent = async () => {
      try {
        // Fetch from database
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return;

        const { data: agentData } = await supabase
          .from('delivery_agents')
          .select('id, name')
          .eq('email', user.email)
          .eq('is_active', true)
          .maybeSingle();

        if (agentData) {
          // Cache in sessionStorage for instant navigation
          sessionStorage.setItem('agentId', agentData.id);
          sessionStorage.setItem('agentName', agentData.name || '');
          
          setAgent({ id: agentData.id });
          setAgentName(agentData.name || '');
          setIsAgentInitialized(true);
          console.log('✅ Cached agent data for faster navigation');
        }
      } catch (error) {
        console.error('Error initializing agent:', error);
      }
    };

    initAgent();
  }, []); // Empty deps - only run once
  
  // Use realtime orders as primary data source - enabled immediately with cached agent
  const {
    orders: realtimeOrders,
    isLoading: isLoadingRealtime,
    isRefreshing: isRefreshingRealtime,
    refreshOrders: realtimeRefresh,
  } = useRealtimeOrders(agent?.id || null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notificationCount] = useState(3);
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
  const notificationCooldownRef = useRef<Map<string, number>>(new Map());
  
  // Refresh debouncing state
  const [isRealTimeRefreshing, setIsRealTimeRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track rejected orders to prevent them from reappearing
  const [rejectedOrderIds, setRejectedOrderIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('rejectedOrderIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Load agent settings on component mount - deferred for faster initial load
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadAgentSettings();
    }, 100); // Defer non-critical loading
    
    return () => clearTimeout(timeout);
  }, []);
  
  // Clean up old rejected orders from localStorage (keep only last 7 days)
  useEffect(() => {
    const cleanupRejectedOrders = () => {
      try {
        // Get current timestamp
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        // Get timestamp of when rejected orders were last cleaned
        const lastCleanup = localStorage.getItem('rejectedOrdersLastCleanup');
        
        // Only clean up once per day
        if (lastCleanup && parseInt(lastCleanup) > sevenDaysAgo) {
          return;
        }
        
        // Clear rejected orders (they should be filtered by backend anyway)
        // This is just client-side cache that gets refreshed periodically
        localStorage.removeItem('rejectedOrderIds');
        localStorage.setItem('rejectedOrdersLastCleanup', Date.now().toString());
        setRejectedOrderIds(new Set());
        
        console.log('🧹 Cleaned up old rejected orders from cache');
      } catch (error) {
        console.error('Error cleaning up rejected orders:', error);
      }
    };
    
    // Run cleanup on mount
    cleanupRejectedOrders();
    
    // Run cleanup daily
    const cleanupInterval = setInterval(cleanupRejectedOrders, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Listen for order completion events and refresh home page immediately
  useEffect(() => {
    const handleOrderCompleted = (event: any) => {
      console.log('🎉 Order completed event received:', event.detail);
      // Immediately refresh orders silently (no toast) to sync with backend
      fetchOrdersForRefresh().catch(error => {
        console.error('Error refreshing after order completion:', error);
      });
    };

    const handleRefreshOrders = () => {
      console.log('🔄 Manual refresh orders event received');
      // Force refresh orders when event is triggered
      debouncedRefresh('manual_refresh', true);
    };

    window.addEventListener('orderCompleted', handleOrderCompleted);
    window.addEventListener('refreshOrders', handleRefreshOrders);
    
    return () => {
      window.removeEventListener('orderCompleted', handleOrderCompleted);
      window.removeEventListener('refreshOrders', handleRefreshOrders);
    };
  }, []);

  const loadAgentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get agent details
      const { data: agentData } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agentData) {
        // Store agent for flexible payment
        setAgent(agentData);
        
        // Get agent settings - respect user preferences
        const { data: agentSettings } = await supabase
          .from('agent_settings')
          .select('ringtone_enabled, ringtone_volume, ringtone_type, notification_frequency')
          .eq('agent_id', agentData.id)
          .maybeSingle();

        if (agentSettings) {
          // Use actual user settings from database - no overrides
          setRingtoneSettings({
            enabled: agentSettings.ringtone_enabled ?? true,
            volume: agentSettings.ringtone_volume ?? 0.8,
            type: agentSettings.ringtone_type ?? 'iphone-6-ringtone',
            frequency: agentSettings.notification_frequency ?? 'double'
          });
          console.log('✅ Loaded agent audio settings from database:', agentSettings);
        }
      }
    } catch (error) {
      console.error('Error loading agent settings:', error);
    }
  };


  // Check if a new order should trigger immediate notification (on INSERT)
  const shouldPlayImmediateNotificationForOrder = (orderData: any): boolean => {
    // Notifications disabled - orders appear silently in list
    return false;
  };

  // Check if a new order should trigger availability notification (when status changes to packed)
  const shouldPlayAvailabilityNotificationForOrder = (orderData: any): boolean => {
    // Notifications disabled - orders appear silently in list
    return false;
  };

  // Centralized notification deduplication - prevents audio collision
  const lastNotificationRef = useRef<Map<string, number>>(new Map());
  
  const shouldPlayNotification = (orderId: string, notificationType: string): boolean => {
    // Notifications disabled - orders appear silently in list
    return false;
  };

  // Check if order should trigger pickup notification for all agents
  const shouldPlayPickupNotificationForOrder = async (orderData: any): Promise<boolean> => {
    // Notifications disabled - orders appear silently in list
    return false;
  };

  // Listen for order assignment events to close emergency modal AND urgent notifications
  useEffect(() => {
    console.log('📡 [REALTIME] Setting up listener for order events');
    
    const channel = supabase
      .channel('orders-realtime-updates')
      .on('broadcast', { event: 'order_assigned' }, (payload) => {
        console.log('📡 [ORDER-ASSIGNED] Received order_assigned event:', payload);
        
        const assignedOrderId = payload.payload?.order_id;
        
        // Stop ringtone if order was accepted by another agent
        stopRingtone();
        
        toast({
          title: "Order Accepted",
          description: "This order was accepted by another agent",
          duration: 3000,
        });
        
        // Remove from recent notifications
        setRecentNotifications(prev => {
          const newSet = new Set(prev);
          newSet.delete(`packed-${assignedOrderId}`);
          newSet.delete(`availability-${assignedOrderId}`);
          newSet.delete(`immediate-${assignedOrderId}`);
          return newSet;
        });
      })
      .on('broadcast', { event: 'urgent_notification' }, async (payload) => {
        console.log('🚨 [URGENT-NOTIFICATION-EARLY] Received broadcast:', payload);
        
        const notificationData = payload.payload;
        if (!notificationData) {
          console.warn('⚠️ [URGENT-NOTIFICATION-EARLY] No notification data in payload');
          return;
        }

        const orderId = notificationData.order_id;
        const notifType = notificationData.notification_type || 'urgent';

        // ✅ Validate distance before showing notification
        const agentLocation = getAgentLocationFromStorage();
        
        if (agentLocation && orderId) {
          try {
            // Fetch order details to get delivery address
            const { data: order } = await supabase
              .from('orders')
              .select('address, pickup_location')
              .eq('id', orderId)
              .single();
            
            if (order?.address) {
              const customerLocation = extractCoordinatesFromAddress(order.address);
              
              if (customerLocation) {
                const distanceResult = await calculateRealTimeDistance(
                  agentLocation,
                  customerLocation,
                  orderId
                );
                
                if (distanceResult.distance_km > 15) {
                  console.log(`❌ Urgent notification for order ${orderId} ignored - ${distanceResult.distance_km.toFixed(2)}km away (>15km)`);
                  return; // Don't show notification
                }
                
                console.log(`✅ Urgent notification for order ${orderId} allowed - ${distanceResult.distance_km.toFixed(2)}km away`);
              }
            }
          } catch (error) {
            console.warn('⚠️ Failed to validate notification distance:', error);
            // Fall through to show notification (fail open)
          }
        }

        // Notifications disabled - orders appear silently in list
        console.log('📝 [URGENT-NOTIFICATION] Notification received, no popup shown');
      })
      .subscribe();
    
    return () => {
      console.log('📡 [REALTIME] Cleaning up realtime listeners');
      supabase.removeChannel(channel);
    };
  }, [toast, stopRingtone, playNotificationSound]);

  // REMOVED: Polling fallback - real-time WebSocket subscriptions handle all updates
  // This was causing 360 duplicate API calls per hour for data already received via WebSocket

  // Check if order should trigger immediate packed status notification
  const shouldPlayPackedStatusNotificationForOrder = (orderData: any): boolean => {
    // Notifications disabled - orders appear silently in list
    return false;
  };

  // Notifications disabled - all handlers removed
  // Orders appear silently in the list without any popups or toasts

  // Handle immediate packed status notification (for any order changing to packed)
  const handlePackedStatusNotification = (orderData: any) => {
    console.log('🚨 [PACKED-NOTIFICATION] Processing for order:', orderData.id);
    console.log('🚨 [PACKED-NOTIFICATION] Order data:', {
      id: orderData.id,
      status: orderData.status,
      customer_name: orderData.customer_name,
      agent_id: orderData.agent_id,
      created_at: orderData.created_at
    });
    
    // CRITICAL: Double-check agent_id is null before showing
    if (orderData.agent_id) {
      console.log('⚠️ [PACKED-NOTIFICATION] Skipping - order already has agent:', orderData.agent_id);
      return;
    }
    
    // CRITICAL: Skip rejected orders
    if (rejectedOrderIds.has(orderData.id)) {
      console.log('🚫 [PACKED-NOTIFICATION] Skipping - order was rejected by agent:', orderData.id);
      return;
    }
    
    if (!shouldPlayPackedStatusNotificationForOrder(orderData)) {
      console.log('⚠️ [PACKED-NOTIFICATION] Skipped by shouldPlay check');
      return;
    }

    // Track modal showing to prevent showing same modal multiple times
    const modalKey = `modal-${orderData.id}`;
    const acceptedKey = `accepted-${orderData.id}`;
    const isDuplicateModal = recentNotifications.has(modalKey) || recentNotifications.has(acceptedKey);
    
    // Track audio to prevent spam
    const audioKey = `audio-${orderData.id}`;
    const isDuplicateAudio = recentNotifications.has(audioKey);
    
    // Notifications disabled - orders appear silently in list
    console.log('📝 [PACKED-NOTIFICATION] Order packed, no notification shown');
  };

  // REMOVED: fetchAgentName - using cached agent data from initialization instead
  // This eliminates duplicate API call for data we already have

  // Calculate real-time distances for all orders (shop to customer + agent to shop)
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
            return { 
              ...order, 
              distance_km: 2.5, 
              eta_mins: 5, 
              agent_to_shop_distance: 2.0,
              distance_source: 'fallback' as const 
            };
          }
          
          if (!customerCoords) {
            console.warn(`❌ Missing customer coordinates for order ${order.id}:`, {
              order_id: order.id,
              customer_address: order.address,
              address_type: typeof order.address
            });
            return { 
              ...order, 
              distance_km: 2.5, 
              eta_mins: 5, 
              agent_to_shop_distance: 2.0,
              distance_source: 'fallback' as const 
            };
          }

          // Calculate distance from shop to customer (actual delivery distance)
          const distanceResult = await calculateRealTimeDistance(
            pickupCoords,
            customerCoords,
            order.id
          );

          // Calculate real-time distance from agent's current location to pickup shop using backend
          let agentToShopDistance = 2.0; // Default fallback
          if (location.latitude && location.longitude) {
            try {
              // Use the backend calculate-delivery-pricing function which already calculates agent-to-order distance
              const { data, error } = await supabase.functions.invoke('calculate-delivery-pricing', {
                body: {
                  order_id: order.id,
                  agent_location: {
                    lat: location.latitude,
                    lng: location.longitude
                  }
                }
              });

              if (!error && data?.success) {
                agentToShopDistance = data.distance_km || 2.0;
                // Use payout from this same call - no need to fetch again later
                const agentPayout = data.payout_amount || 0;
                console.log(`📏 Backend calculated - Distance: ${agentToShopDistance} km, Payout: ₹${agentPayout}`);
                
                return {
                  ...order,
                  distance_km: distanceResult.distance_km,
                  eta_mins: distanceResult.eta_mins,
                  agent_to_shop_distance: agentToShopDistance,
                  total_distance: agentToShopDistance + distanceResult.distance_km,
                  agent_payout: agentPayout, // Set payout here from same API call
                  distance_source: distanceResult.source,
                  backend_calculated: true
                };
              } else {
                console.warn(`⚠️ Backend distance calculation failed for ${order.id}:`, error || data);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to calculate agent-to-shop distance for order ${order.id}:`, error);
            }
          }

          console.log('✅ Distances calculated (fallback):', {
            orderId: order.id,
            pickup: pickupCoords,
            customer: customerCoords,
            deliveryDistance: distanceResult.distance_km + 'km',
            agentToShopDistance: agentToShopDistance + 'km',
            eta: distanceResult.eta_mins + 'min',
            source: distanceResult.source
          });

          return {
            ...order,
            distance_km: distanceResult.distance_km,
            eta_mins: distanceResult.eta_mins,
            agent_to_shop_distance: agentToShopDistance,
            distance_source: distanceResult.source as 'realtime' | 'cached' | 'fallback'
          };
        } catch (error) {
          console.error(`❌ Error calculating distance for order ${order.id}:`, error);
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
      // Use backend classification first, then fallback to frontend logic
      delivery_type: order.calculated_delivery_type || (() => {
        // Fallback frontend logic if backend doesn't provide classification
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
      agent_payout: order.agent_payout || undefined,
      estimated_time_minutes: order.estimated_time_minutes || undefined,
      subscription_id: order.subscription_id || undefined,
      
      delivery_slots: parseDeliverySlots(order),
      pickup_location: pickupLocation,
      pickup_address: pickupAddress,
      seller_phone: sellerPhone,
      seller_name: sellerName,
      
      // Pass through backend classification and timing data
      calculated_delivery_type: order.calculated_delivery_type,
      immediate_timing_config: order.immediate_timing_config,
      original_created_at: order.original_created_at
    };
  };

  // Unified fetch orders function with deduplication
  const fetchOrdersData = async (showLoading: boolean = false): Promise<Order[]> => {
    try {
      // Add 10-second timeout to prevent infinite loading
      const fetchPromise = (async () => {
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
            .in('status', ['packed', 'assigned', 'picked_up', 'in_transit'])
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
        
        // Filter out rejected orders client-side to prevent reappearance
        const filteredOrders = deduplicatedOrders.filter(order => !rejectedOrderIds.has(order.id));
        
        if (rejectedOrderIds.size > 0) {
          const rejectedCount = deduplicatedOrders.length - filteredOrders.length;
          if (rejectedCount > 0) {
            console.log(`🚫 Filtered out ${rejectedCount} rejected orders`);
          }
        }
        
        console.log(`📊 Orders processed: ${availableOrders.length} available, ${assignedOrders.length} assigned, ${deduplicatedOrders.length} total after deduplication, ${filteredOrders.length} after filtering rejected`);
        
        return filteredOrders;
      })();
      
      // Create timeout promise
      const timeoutPromise = new Promise<Order[]>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      // Race between fetch and timeout
      return await Promise.race([fetchPromise, timeoutPromise]);
      
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      if (error?.message === 'Request timeout') {
        console.error('⏱️ Fetch timeout - falling back to real-time data');
        toast({
          title: "Slow Connection",
          description: "Using cached data. Pull to refresh when online.",
          variant: "default",
        });
      }
      return []; // Return empty array instead of throwing
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

  // Debounced refresh function to prevent race conditions
  const debouncedRefresh = async (reason: string = 'unknown', immediate: boolean = false) => {
    console.log(`🔄 Refresh requested: ${reason} (immediate: ${immediate})`);
    
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // If already refreshing, skip
    if (isRealTimeRefreshing && !immediate) {
      console.log('⏳ Refresh already in progress, skipping...');
      return;
    }
    
    const performRefresh = async () => {
      if (isRealTimeRefreshing) return;
      
      setIsRealTimeRefreshing(true);
      try {
        console.log(`✅ Executing refresh: ${reason}`);
        await fetchOrdersForRefresh();
        console.log(`✅ Refresh completed: ${reason}`);
      } catch (error) {
        console.error(`❌ Refresh failed: ${reason}`, error);
      } finally {
        setTimeout(() => setIsRealTimeRefreshing(false), 100);
      }
    };
    
    if (immediate) {
      // For critical updates like packed orders, refresh immediately
      await performRefresh();
    } else {
      // For other updates, debounce to prevent rapid fire calls
      refreshTimeoutRef.current = setTimeout(performRefresh, 100);
    }
  };

  // Pull to refresh functionality
  const handleRefresh = useCallback(async () => {
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
  }, [realtimeRefresh]);

  // Accept order - Memoized event handler
  const handleAcceptOrder = useCallback(async (orderId: string) => {
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
  }, [agent?.id, toast, navigate]);

  // Test function to trigger emergency modal with sample data
  const handleTestNewOrder = async () => {
    console.log('🚀 TEST BUTTON CLICKED! Starting handleTestNewOrder function');
    console.log('🔊 Current ringtone settings:', ringtoneSettings);
    
    const testOrderData = {
      id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID for testing
      customer_name: "Test Customer",
      customer_phone: "+91 9876543210",
      address: "Test Address 123",
      items: [{ name: "Test Item", quantity: 2 }],
      total: 150.00,
      created_at: new Date().toISOString(),
      pickup_address: "Test Pickup Location",
      seller_name: "Test Seller",
      seller_phone: "+91 8765432109",
      status: "packed",
      delivery_date: new Date().toISOString(),
      delivery_time_slot: "10:00 AM - 12:00 PM",
      payment_status: "pending"
    };
    
    console.log('🔊 Test button clicked - attempting to play sound');
    
    // Play emergency sound with explicit settings
    console.log('🔊 About to test full backend notification flow...');
    
    // Test the FULL backend notification system
    try {
      console.log('🚀 Calling backend mark-order-as-packed to trigger real notifications...');
      
      // Call the backend function to trigger real notifications
      const { data, error } = await supabase.functions.invoke('mark-order-as-packed', {
        body: {
          order_id: testOrderData.id,
          marked_by: 'test-system@zaago.com'
        }
      });
      
      if (error) {
        console.error('🔊 Backend test call failed:', error);
        throw error;
      }
      
      console.log('🔊 Backend test call successful:', data);
      
      toast({
        title: "🚨 Backend Test Triggered!",
        description: "Real backend notification sent - sound should play soon",
        duration: 5000,
      });
      
    } catch (error) {
      console.error('🔊 Backend test failed, trying frontend fallback:', error);
      
      // Fallback to frontend test
      try {
        console.log('🔊 Attempting frontend fallback notification sound...');
        await playNotificationSound();
        console.log('🔊 Frontend fallback successful');
        
        toast({
          title: "🔊 Frontend Test",
          description: "Backend failed, played frontend audio instead",
          variant: "destructive"
        });
        
      } catch (frontendError) {
        console.error('🔊 Frontend fallback also failed:', frontendError);
        
        // Manual audio test
        try {
          console.log('🔊 Trying manual audio...');
          const testAudio = new Audio('/iphone-6-original-ringtone.mp3');
          testAudio.volume = 0.8;
          
          // Add user interaction handler for browsers that block autoplay
          if (testAudio.readyState === 0) {
            console.log('🔊 Audio not loaded, loading first...');
            testAudio.load();
            await new Promise((resolve) => {
              testAudio.addEventListener('canplay', resolve, { once: true });
            });
          }
          
          await testAudio.play();
          console.log('🔊 Manual audio successful');
          
          toast({
            title: "🔊 Manual Audio Test",
            description: "Backend + Frontend failed, manual audio played",
            variant: "destructive"
          });
          
        } catch (manualError) {
          console.error('🔊 Everything failed:', manualError);
          toast({
            title: "❌ All Audio Tests Failed",
            description: "Please check browser permissions and try again. Error: " + manualError.message,
            variant: "destructive"
          });
        }
      }
    }
  };

  // Reject order
  const handleRejectOrder = useCallback(async (orderId: string) => {
    setRejectingOrders(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) {
        console.error('Agent not found');
        toast({
          title: "Error",
          description: "Unable to find agent profile",
          variant: "destructive"
        });
        return;
      }

      // Add to rejected orders list immediately to prevent reappearance
      setRejectedOrderIds(prev => {
        const updated = new Set(prev);
        updated.add(orderId);
        localStorage.setItem('rejectedOrderIds', JSON.stringify(Array.from(updated)));
        return updated;
      });

      // Call backend to persist rejection
      const { error } = await supabase.functions.invoke('cancel-delivery', {
        body: { 
          order_id: orderId,
          agent_id: agent.id,
          cancellation_reason: 'Agent rejected order'
        }
      });

      if (error) {
        console.error('Error rejecting order:', error);
        // Revert rejection on error
        setRejectedOrderIds(prev => {
          const updated = new Set(prev);
          updated.delete(orderId);
          localStorage.setItem('rejectedOrderIds', JSON.stringify(Array.from(updated)));
          return updated;
        });
        toast({
          title: "Error",
          description: "Failed to reject order. Please try again.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Order Rejected",
        description: "You won't see this order again.",
      });
      
      // Remove from current orders list
      setOrders(prev => prev.filter(order => order.id !== orderId));
      
      // Stop ringtone if playing
      stopRingtone();
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast({
        title: "Error",
        description: "Failed to reject order. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRejectingOrders(prev => ({ ...prev, [orderId]: false }));
    }
  }, [toast]);

  // Memoized sort function - only recalculates when orders or sortBy changes
  const sortedOrders = useMemo(() => {
    if (!orders || orders.length === 0) {
      return [];
    }
    
    return [...orders].sort((a, b) => {
      switch (sortBy) {
        case 'nearest': {
          // Priority: agent_to_shop_distance (backend) > total_distance > distance_km
          const distA = Number(a.agent_to_shop_distance ?? a.total_distance ?? a.distance_km ?? 999);
          const distB = Number(b.agent_to_shop_distance ?? b.total_distance ?? b.distance_km ?? 999);
          
          if (isNaN(distA) || isNaN(distB)) return 0;
          return distA - distB;
        }
        case 'newest': {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          
          if (isNaN(timeA) || isNaN(timeB)) return 0;
          return timeB - timeA;
        }
        case 'highest': {
          const payoutA = Number(a.agent_payout ?? calculateAgentPayout(a.distance_km || 2.5));
          const payoutB = Number(b.agent_payout ?? calculateAgentPayout(b.distance_km || 2.5));
          
          if (isNaN(payoutA) || isNaN(payoutB)) return 0;
          return payoutB - payoutA;
        }
        default:
          return 0;
      }
    });
  }, [orders, sortBy]);

  // Memoized available orders - only recalculates when sortedOrders change
  const availableOrders = useMemo(() => {
    return sortedOrders.filter(order => {
      // Filter out delivered orders
      if (order.status === 'delivered') return false;
      
      // Filter out orders beyond 15km radius
      if (order.distance_km !== undefined && order.distance_km > 15) {
        console.log(`❌ Filtering out order ${order.id} - ${order.distance_km.toFixed(2)}km away (>15km)`);
        return false;
      }
      
      // Filter out expired immediate deliveries (more than 2 hours old)
      if (order.delivery_type === 'immediate' && order.order_placed_at) {
        const now = new Date();
        const orderTime = new Date(order.order_placed_at);
        const hoursSinceOrder = (now.getTime() - orderTime.getTime()) / (1000 * 60 * 60);
        
        // Only show immediate orders that are less than 2 hours old
        if (hoursSinceOrder > 2) {
          return false;
        }
      }
      
      return true;
    });
  }, [sortedOrders]);

  // Memoized assigned orders
  const assignedOrders = useMemo(() => {
    return availableOrders.filter(order => order.status === 'assigned');
  }, [availableOrders]);

  // Track previous location to prevent unnecessary refreshes
  const [lastLocationRefresh, setLastLocationRefresh] = useState<{lat: number, lng: number} | null>(null);
  const [lastDistanceCalculation, setLastDistanceCalculation] = useState<{lat: number, lng: number} | null>(null);

  // Auto-update location when geolocation data is available
  useEffect(() => {
    if (location.address && location.address !== 'Fetching address...') {
      // Format the address to show only key parts (city, state)
      const addressParts = location.address.split(',').map(part => part.trim());
      const shortAddress = addressParts.length > 2 
        ? addressParts.slice(-3).join(', ') // Show last 3 parts (typically area, city, state)
        : location.address;
      setCurrentLocation(shortAddress);
    } else if (location.loading && location.latitude && location.longitude) {
      setCurrentLocation('Fetching address...');
    } else if (location.latitude && location.longitude) {
      setCurrentLocation('Location detected');
    } else {
      setCurrentLocation('Tap to set location');
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
      
      // Recalculate distances when location changes significantly (more than 200m for better performance)
      if (orders.length > 0) {
        if (!lastDistanceCalculation) {
          setLastDistanceCalculation(currentPos);
          calculateOrderDistances(orders).then(setOrders);
        } else {
          const distanceChange = Math.sqrt(
            Math.pow(currentPos.lat - lastDistanceCalculation.lat, 2) + 
            Math.pow(currentPos.lng - lastDistanceCalculation.lng, 2)
          ) * 111000; // Rough conversion to meters
          
          // Recalculate distances if moved more than 200 meters (reduced frequency)
          if (distanceChange > 200) {
            setLastDistanceCalculation(currentPos);
            calculateOrderDistances(orders).then(setOrders);
          }
        }
      }
    }
  }, [location.address, location.latitude, location.longitude, orders.length]);

  // Optimized real-time subscription - only broadcast events
  // useRealtimeOrders hook handles all order database changes efficiently
  useEffect(() => {
    console.log('🔧 [REALTIME-SETUP] Setting up optimized broadcast listeners');
    
    const channel = supabase
      .channel('orders-realtime-updates')
      .on(
        'broadcast',
        { event: 'urgent_notification' },
        (payload) => {
          console.log('🚨 [BROADCAST-AUDIO] Received urgent notification:', payload);
          
          const notificationData = payload.payload;
          const orderId = notificationData?.order_id;
          
          if (!orderId) {
            console.log('⚠️ [BROADCAST-AUDIO] No order ID in notification');
            return;
          }
          
          // Use existing deduplication system with Map
          if (!shouldPlayNotification(orderId, 'urgent_broadcast')) {
            return; // Already logged by shouldPlayNotification
          }
          
          // Handle urgent notifications from notify-delivery-agents edge function
          if (notificationData && notificationData.notification_type === 'order_packed') {
            console.log('🔊 [BROADCAST-AUDIO] Processing packed order notification');
            
            // Notifications disabled - orders appear silently in list
            console.log('📝 [BROADCAST] Order packed, no notification shown');
            
            // Immediate refresh for agent assignment notifications
            debouncedRefresh('urgent-notification-agent-assignment', true);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Optimized real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to broadcast channels (order updates handled by useRealtimeOrders hook)');
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
        calculateOrderDistances(orders).then(async (updatedOrders) => {
          // Filter out orders beyond 15km BEFORE updating state
          const nearbyOrders = updatedOrders.filter(order => {
            if (order.distance_km === undefined) return true; // Keep if distance unknown
            if (order.distance_km > 15) {
              console.log(`❌ Filtering order ${order.id} - ${order.distance_km.toFixed(2)}km away (>15km)`);
              return false;
            }
            return true;
          });
          
          // Calculate accurate payouts using backend for nearby orders only
          const ordersWithPayouts = await Promise.all(
            nearbyOrders.map(async (order) => {
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

  // Real-time distance and payout updates with location threshold to prevent constant recalculation
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  
  useEffect(() => {
    if (orders.length === 0 || !location.latitude || !location.longitude) return;
    
    // Calculate distance moved since last update
    const hasMovedSignificantly = (() => {
      if (!lastLocationRef.current) return true; // First time, always update
      
      const lastLat = lastLocationRef.current.lat;
      const lastLng = lastLocationRef.current.lng;
      const currentLat = location.latitude;
      const currentLng = location.longitude;
      
      // Haversine formula for distance in meters
      const R = 6371000; // Earth radius in meters
      const dLat = (currentLat - lastLat) * Math.PI / 180;
      const dLng = (currentLng - lastLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lastLat * Math.PI / 180) * Math.cos(currentLat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in meters
      
      return distance > 100; // Only recalculate if moved >100 meters
    })();
    
    if (!hasMovedSignificantly) {
      console.log('⏭️ Location changed but <100m - skipping distance recalculation');
      return;
    }
    
    console.log('📍 Significant location change detected (>100m) - recalculating distances');
    lastLocationRef.current = { lat: location.latitude, lng: location.longitude };
    
    let isMounted = true;
    
    const updateDistancesAndPayouts = async () => {
      if (!isMounted) return;
      
      const updatedOrders = await calculateOrderDistances(orders.slice(0, 15)); // Only top 15 orders for performance
      
      if (!isMounted) return;
      
      // Payout already set in calculateOrderDistances - no need to recalculate
      // This removes 15 duplicate API calls every time location changes
      
      if (!isMounted) return;
      
      // Only update if distance data actually changed
      setOrders(prev => {
        const hasChanges = updatedOrders.some((newOrder, idx) => {
          const oldOrder = prev[idx];
          return !oldOrder || oldOrder.distance_km !== newOrder.distance_km;
        });
        return hasChanges ? updatedOrders : prev;
      });
    };

    // Initial calculation
    updateDistancesAndPayouts();
    
    // Reduce frequency to 10 minutes (only as backup, location threshold is primary control)
    const interval = setInterval(updateDistancesAndPayouts, 600000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [location.latitude, location.longitude]);

  // REMOVED: Auto-refresh interval - real-time WebSocket subscriptions handle all updates
  // This was causing 60 duplicate API calls per hour for data already received via WebSocket

  // Trigger location picker when showLocationPicker changes
  useEffect(() => {
    if (showLocationPicker && locationPickerTrigger) {
      locationPickerTrigger.click();
      setShowLocationPicker(false);
    }
  }, [showLocationPicker, locationPickerTrigger]);

  // Process realtime orders with distance calculation - FIXED infinite loop
  useEffect(() => {
    let isMounted = true;
    
    const processOrders = async () => {
      if (!realtimeOrders || realtimeOrders.length === 0) {
        if (isMounted) setOrders([]);
        return;
      }
      
      // Only recalculate if orders actually changed (compare IDs)
      const newOrderIds = realtimeOrders.map(o => o.id).sort().join(',');
      const currentOrderIds = orders.map(o => o.id).sort().join(',');
      
      if (newOrderIds === currentOrderIds) {
        return; // No change
      }
      
      const processed = await calculateOrderDistances(realtimeOrders);
      if (isMounted) {
        setOrders(processed);
      }
    };
    
    processOrders();
    
    return () => {
      isMounted = false;
    };
  }, [realtimeOrders]);

  // Show loading if location not yet available
  if (!location.latitude || !location.longitude || location.loading) {
    return (
      <div className="flex flex-col h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="p-4">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-gray-600 font-medium">Detecting your location...</p>
            <p className="text-sm text-gray-400 mt-2">This helps us show nearby orders</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingRealtime) {
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Zaago Delivery Agent</h1>
            <div className="flex items-center text-xs text-gray-500 mt-1 cursor-pointer hover:text-gray-700 transition-colors" onClick={() => setShowLocationPicker(true)}>
              <MapPin className="w-3 h-3 mr-1 text-red-500 flex-shrink-0" />
              <span className="truncate max-w-[150px] sm:max-w-[280px]">{currentLocation}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/notifications')}
                className="hover:bg-gray-100 h-9 w-9"
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
              variant="outline" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="hover:bg-gray-100 border-2 border-gray-400 bg-white h-9 w-9"
            >
              <User className="w-5 h-5 text-gray-700" />
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
            className={`h-12 rounded-lg border-gray-300 text-gray-700 hover:bg-gray-100 bg-white transition-all duration-200 ${
              isAutoRefreshing ? 'ring-2 ring-green-200 bg-green-50' : ''
            }`}
            disabled={isRefreshing}
          >
            {isRefreshing || isAutoRefreshing ? (
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 animate-spin text-gray-700 mr-1" />
                <span className="text-xs text-gray-700">
                  {isRefreshing ? 'Manual' : 'Auto'} Refresh
                </span>
              </div>
            ) : (
              <div className="flex items-center">
                <RefreshCw className="w-4 h-4 text-gray-700 mr-1" />
                <span className="text-xs text-gray-700">Refresh</span>
                <div className="w-2 h-2 bg-green-400 rounded-full ml-1 animate-pulse" title="Auto-refreshes every 2 seconds + Real-time updates"></div>
              </div>
            )}
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
              <SelectTrigger className="w-auto min-w-[140px] h-10 px-3 py-2 bg-green-50 border-2 border-green-200 rounded-full text-green-700 hover:bg-green-100 hover:border-green-300 transition-colors">
                <div className="flex items-center space-x-2">
                  {sortBy === 'highest' && <IndianRupee className="w-4 h-4" />}
                  {sortBy === 'nearest' && <Target className="w-4 h-4" />}
                  {sortBy === 'newest' && <Clock className="w-4 h-4" />}
                  <SelectValue className="text-green-700 font-medium" />
                </div>
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white border-2 border-gray-200 shadow-2xl rounded-xl min-w-[180px] p-2">
                <SelectItem 
                  value="nearest" 
                  className="text-gray-900 hover:bg-green-50 cursor-pointer rounded-lg px-3 py-2.5 my-1 font-medium data-[state=checked]:bg-green-100 data-[state=checked]:text-green-700"
                >
                  Nearest First
                </SelectItem>
                <SelectItem 
                  value="newest" 
                  className="text-gray-900 hover:bg-green-50 cursor-pointer rounded-lg px-3 py-2.5 my-1 font-medium data-[state=checked]:bg-green-100 data-[state=checked]:text-green-700"
                >
                  Newest First
                </SelectItem>
                <SelectItem 
                  value="highest" 
                  className="text-gray-900 hover:bg-green-50 cursor-pointer rounded-lg px-3 py-2.5 my-1 font-medium data-[state=checked]:bg-green-100 data-[state=checked]:text-green-700"
                >
                  Highest First
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders within 15km</h3>
                <p className="text-gray-500 mb-4">
                  Orders will appear here when customers place orders near your location
                </p>
                {location.latitude && location.longitude && (
                  <p className="text-gray-400 text-xs mt-2">
                    📍 Showing orders within 15km of your current location
                  </p>
                )}
                {!isOnline && (
                  <Button
                    onClick={() => setIsOnline(true)}
                    className="bg-green-500 hover:bg-green-600 text-white mt-4"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Go Online
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {availableOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isLoadingDistance={isLoadingDistance}
                    acceptingOrders={acceptingOrders}
                    rejectingOrders={rejectingOrders}
                    onAccept={handleAcceptOrder}
                    onReject={handleRejectOrder}
                    calculateAgentPayout={calculateAgentPayout}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Location Picker - Hidden trigger */}
      <Suspense fallback={<div />}>
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
      </Suspense>
    </div>
  );
};

export default Home;
