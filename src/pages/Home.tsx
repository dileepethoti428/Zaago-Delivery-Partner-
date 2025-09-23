
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
}


const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playNotificationSound } = useAudioNotification();
  
  // Get current location with backend saving 
  const location = useGeolocation({
    enableHighAccuracy: false, // Use network location for speed
    timeout: 3000, // Fast timeout for initial detection
    saveToBackend: true,
    refreshInterval: 0, // We'll handle manual refresh with auto-refresh
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

  // Fetch orders from backend (filtered by agent exclusions) - Optimized
  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      
      // Add timeout for faster user experience
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000) // 8 second timeout
      );
      
      // Get current agent ID with error handling
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

      // Fetch delivery slots for reference
      const { data: deliverySlots } = await supabase
        .from('delivery_slots')
        .select('id, slot_name, start_time, end_time')
        .eq('is_active', true);
        
      console.log('Fetched delivery slots:', deliverySlots);

      // Fetch both available orders and assigned orders in parallel
      const [availableOrdersResult, assignedOrdersResult] = await Promise.all([
        // Available orders from edge function
        Promise.race([
          supabase.functions.invoke('get-available-orders', {
            body: { agent_id: agent.id }
          }),
          timeoutPromise
        ]),
        // Assigned orders directly from database
        supabase
          .from('orders')
          .select(`
            id, status, total, created_at, updated_at, agent_id,
            customer_name, customer_phone, address, items,
            special_instructions, delivery_time_slot, delivery_date,
            delivery_time, subscription_id, payment_status
          `)
          .eq('agent_id', agent.id)
          .in('status', ['assigned', 'picked_up', 'in_transit'])
          .order('created_at', { ascending: false })
      ]);

      // Handle available orders
      const { data: availableResponse, error: availableError } = availableOrdersResult as any;
      if (availableError) throw availableError;

      if (!availableResponse.success) {
        throw new Error(availableResponse.error || 'Failed to fetch available orders');
      }

      // Handle assigned orders
      const { data: assignedOrders, error: assignedError } = assignedOrdersResult;
      if (assignedError) throw assignedError;

      // Helper function to match single time with delivery slots
      const matchTimeWithSlot = (timeString: string) => {
        if (!deliverySlots || !timeString) {
          console.log('matchTimeWithSlot: No slots or timeString', { slotsCount: deliverySlots?.length, timeString });
          return null;
        }
        
        // Convert timeString to comparable format
        const targetTime = timeString.length === 5 ? timeString + ':00' : timeString;
        console.log('matchTimeWithSlot: Looking for time', targetTime, 'in', deliverySlots.length, 'slots');
        
        // Find matching delivery slot
        const matchedSlot = deliverySlots.find(slot => {
          const slotStart = slot.start_time;
          const slotEnd = slot.end_time;
          
          console.log(`Checking slot ${slot.slot_name}: ${slotStart} <= ${targetTime} <= ${slotEnd}`);
          
          // Check if the target time falls within this slot
          return targetTime >= slotStart && targetTime <= slotEnd;
        });
        
        if (matchedSlot) {
          console.log('Found matching slot:', matchedSlot);
          // Format times for display (remove seconds)
          const formatTime = (time: string) => time.substring(0, 5);
          
          return {
            id: matchedSlot.id,
            slot_name: matchedSlot.slot_name,
            start_time: matchedSlot.start_time,
            end_time: matchedSlot.end_time,
            formatted_range: `${formatTime(matchedSlot.start_time)} - ${formatTime(matchedSlot.end_time)}`
          };
        }
        
        console.log('No matching slot found for time:', targetTime);
        return null;
      };

      // Transform available orders to match our interface
      const transformedAvailableOrders: Order[] = (availableResponse.orders || []).map((order, index) => {
        // Parse delivery slots for timing intervals
        let deliverySlots = null;
        let scheduledTime = null;
        let formattedDeliveryTime = null;

        if (order.delivery_time_slot) {
          const timeSlot = order.delivery_time_slot;
          
          // Handle time intervals like "18:00-20:00" or "22:00-00:00"
          if (timeSlot.includes('-') && timeSlot.match(/\d{1,2}:\d{2}-\d{1,2}:\d{2}/)) {
            const [startTime, endTime] = timeSlot.split('-');
            deliverySlots = {
              id: `slot-${order.id}`,
              slot_name: `${startTime} - ${endTime}`,
              start_time: startTime.length === 5 ? startTime + ':00' : startTime,
              end_time: endTime.length === 5 ? endTime + ':00' : endTime,
            };
            
            // Set scheduled time using start time
            if (order.delivery_date) {
              try {
                const dateTimeString = order.delivery_date + 'T' + deliverySlots.start_time;
                const date = new Date(dateTimeString);
                if (!isNaN(date.getTime())) {
                  scheduledTime = date.toISOString();
                }
              } catch (error) {
                console.warn('Failed to parse scheduled time for order:', order.id, error);
              }
            }
          } else {
            // Handle single time slots - match with delivery_slots table
            let timeString = '';
            
            if (timeSlot.includes('-')) {
              // Format like "morning-early"
              const timePart = timeSlot.split('-')[0];
              const timeMap = {
                'morning': '08:00:00',
                'afternoon': '14:00:00',
                'evening': '18:00:00'
              };
              timeString = timeMap[timePart] || '12:00:00';
            } else if (timeSlot.includes(':')) {
              timeString = timeSlot.length === 5 ? timeSlot + ':00' : timeSlot;
            } else {
              timeString = '12:00:00'; // fallback
            }
            
        // Try to match with actual delivery slot
        const matchedSlot = matchTimeWithSlot(timeString);
        if (matchedSlot) {
          console.log(`Order ${order.id} matched slot:`, matchedSlot);
          deliverySlots = {
            id: matchedSlot.id,
            slot_name: matchedSlot.formatted_range,
            start_time: matchedSlot.start_time,
            end_time: matchedSlot.end_time,
          };
          timeString = matchedSlot.start_time;
        } else {
          console.log(`Order ${order.id} no slot match for time:`, timeString, 'Available slots:', deliverySlots?.length || 0);
        }
            
            // Set scheduled time for single time slots
            if (order.delivery_date) {
              try {
                const dateTimeString = order.delivery_date + 'T' + timeString;
                const date = new Date(dateTimeString);
                if (!isNaN(date.getTime())) {
                  scheduledTime = date.toISOString();
                }
              } catch (error) {
                console.warn('Failed to parse scheduled time for order:', order.id, error);
              }
            }
          }
        }

        // Format delivery time for display (fallback for single delivery times)
        if (order.delivery_time) {
          try {
            // Convert "12:00:00" to "12:00 PM" format
            const [hours, minutes] = order.delivery_time.split(':');
            const hour24 = parseInt(hours);
            const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
            const ampm = hour24 >= 12 ? 'PM' : 'AM';
            formattedDeliveryTime = `${hour12}:${minutes} ${ampm}`;
          } catch (error) {
            console.warn('Failed to format delivery time:', order.delivery_time, error);
            formattedDeliveryTime = order.delivery_time;
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
          // Determine delivery type - only subscription and time slots make it scheduled
          delivery_type: order.subscription_id || order.delivery_time_slot ? 'scheduled' : 'immediate',
          scheduled_time: scheduledTime,
          // Preserve original delivery_time from backend for scheduled orders only
          delivery_time: (order.subscription_id || order.delivery_time_slot) ? 
            (formattedDeliveryTime || order.delivery_time) : 
            null, // Will be calculated for immediate orders
          subscription_id: order.subscription_id,
          order_placed_at: new Date(order.created_at),
          delivery_slots: deliverySlots
        };
      });

      // Transform assigned orders to match our interface
      const transformedAssignedOrders: Order[] = (assignedOrders || []).map((order) => {
        // Parse delivery slots for assigned orders too
        let deliverySlots = null;
        let scheduledTime = null;
        let formattedDeliveryTime = null;

        // Check for delivery_time_slot first (priority for intervals), then delivery_time
        if (order.delivery_time_slot) {
          const timeSlot = order.delivery_time_slot;
          
          // Handle time intervals like "18:00-20:00" or "22:00-00:00"
          if (timeSlot.includes('-') && timeSlot.match(/\d{1,2}:\d{2}-\d{1,2}:\d{2}/)) {
            const [startTime, endTime] = timeSlot.split('-');
            deliverySlots = {
              id: `slot-${order.id}`,
              slot_name: `${startTime} - ${endTime}`,
              start_time: startTime.length === 5 ? startTime + ':00' : startTime,
              end_time: endTime.length === 5 ? endTime + ':00' : endTime,
            };
            
            // Set scheduled time using start time
            if (order.delivery_date) {
              try {
                const dateTimeString = order.delivery_date + 'T' + deliverySlots.start_time;
                const date = new Date(dateTimeString);
                if (!isNaN(date.getTime())) {
                  scheduledTime = date.toISOString();
                }
              } catch (error) {
                console.warn('Failed to parse scheduled time for assigned order:', order.id, error);
              }
            }
          } else {
            // Handle single time slots - match with delivery_slots table
            let timeString = timeSlot.includes(':') ? 
              (timeSlot.length === 5 ? timeSlot + ':00' : timeSlot) : 
              '12:00:00';
              
        // Try to match with actual delivery slot
        const matchedSlot = matchTimeWithSlot(timeString);
        if (matchedSlot) {
          console.log(`Assigned order ${order.id} matched slot:`, matchedSlot);
          deliverySlots = {
            id: matchedSlot.id,
            slot_name: matchedSlot.formatted_range,
            start_time: matchedSlot.start_time,
            end_time: matchedSlot.end_time,
          };
          timeString = matchedSlot.start_time;
        } else {
          // Fallback: use the single time as formatted delivery time
          console.log(`Assigned order ${order.id} no slot match for time:`, timeString);
          formattedDeliveryTime = timeSlot;
        }
            
            if (order.delivery_date && timeString.includes(':')) {
              try {
                const dateTimeString = order.delivery_date + 'T' + timeString;
                const date = new Date(dateTimeString);
                if (!isNaN(date.getTime())) {
                  scheduledTime = date.toISOString();
                }
              } catch (error) {
                console.warn('Failed to parse scheduled time for assigned order:', order.id, error);
              }
            }
          }
        } else if (order.delivery_time) {
          // Use delivery_time if delivery_time_slot is not available
          let timeString = order.delivery_time.includes(':') ? 
            (order.delivery_time.length === 5 ? order.delivery_time + ':00' : order.delivery_time) : 
            '12:00:00';
            
          console.log(`Order ${order.id}: Trying to match delivery_time "${order.delivery_time}" -> "${timeString}"`);
            
          // Try to match with actual delivery slot
          const matchedSlot = matchTimeWithSlot(timeString);
          if (matchedSlot) {
            console.log(`Assigned order ${order.id} from delivery_time matched slot:`, matchedSlot);
            deliverySlots = {
              id: matchedSlot.id,
              slot_name: matchedSlot.slot_name,
              start_time: matchedSlot.start_time,
              end_time: matchedSlot.end_time,
            };
            formattedDeliveryTime = `${matchedSlot.formatted_range}`;
          } else {
            console.log(`Assigned order ${order.id} no slot match for delivery_time:`, timeString);
            formattedDeliveryTime = order.delivery_time;
          }
          
          if (order.delivery_date && timeString.includes(':')) {
            try {
              const dateTimeString = order.delivery_date + 'T' + timeString;
              const date = new Date(dateTimeString);
              if (!isNaN(date.getTime())) {
                scheduledTime = date.toISOString();
              }
            } catch (error) {
              console.warn('Failed to parse scheduled time from delivery_time for assigned order:', order.id, error);
            }
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
          distance_km: undefined, // Will be calculated for immediate orders only
          agent_payout: undefined, // Will be calculated
          estimated_time_minutes: undefined, // Will be calculated  
          backend_calculated: false,
          delivery_type: order.delivery_time_slot || order.subscription_id ? 'scheduled' : 'immediate',
          scheduled_time: scheduledTime,
          // Preserve original delivery_time from backend for scheduled orders only
          delivery_time: (order.delivery_time_slot || order.subscription_id) ? 
            (formattedDeliveryTime || order.delivery_time) : 
            null, // Will be calculated for immediate orders
          subscription_id: order.subscription_id,
          order_placed_at: new Date(order.created_at),
          delivery_slots: deliverySlots
        };
      });

      // Combine both available and assigned orders
      const allOrders = [...transformedAvailableOrders, ...transformedAssignedOrders];
      setOrders(allOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      setOrders([]);
      setOrdersWithDistance([]);
      
      // Only show toast if it's not an auto-refresh (to avoid spam)
      if (!isRefreshing) {
        const isNetworkError = error.message?.includes('Failed to fetch') || 
                              error.message?.includes('timeout') ||
                              error.message?.includes('Request timeout');
        toast({
          title: isNetworkError ? "Connection Issue" : "Failed to fetch orders",
          description: isNetworkError 
            ? "Poor network connection. Orders will retry automatically." 
            : error.message || "Please check your connection and try again",
          variant: "destructive",
        });
      }
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
        // For scheduled orders and subscription orders, preserve their exact backend timing
        if (order.delivery_type === 'scheduled' || order.subscription_id) {
          console.log(`Preserving scheduled order ${order.id} timing:`, {
            original_delivery_time: order.delivery_time,
            delivery_slots: order.delivery_slots,
            scheduled_time: order.scheduled_time,
            subscription_id: order.subscription_id
          });
          
          // Don't modify delivery_time for scheduled orders - keep exact backend data
          return {
            ...order,
            distance_km: order.distance_km || 2.5, // Keep distance for sorting only
            backend_calculated: order.distance_km ? true : false
          };
        }
        
        // Only calculate travel time for immediate orders
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
    
    // Set up auto-refresh for orders every 45 seconds (reduced frequency for better performance)
    const autoRefreshInterval = setInterval(async () => {
      console.log('Auto-refreshing orders...');
      
      // Only auto-refresh if not already loading and user is active
      if (!isLoading && !isRefreshing && document.visibilityState === 'visible') {
        try {
          await fetchOrders();
          
          // Refresh location less frequently (every other auto-refresh)
          if (Math.random() > 0.5 && location.getCurrentLocation) {
            location.getCurrentLocation();
          }
        } catch (error) {
          console.error('Auto-refresh failed:', error);
          // Silent fail for auto-refresh to avoid spam
        }
      }
    }, 45000); // 45 seconds - increased from 30 for better performance
    
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
            // Play notification sound like phone ringtone
            playNotificationSound();
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
              // Play notification sound like phone ringtone for new orders
              playNotificationSound();
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
      clearInterval(autoRefreshInterval);
      window.removeEventListener('orderCompleted', handleOrderCompleted);
      window.removeEventListener('orderCancelled', handleOrderCancelled);
      supabase.removeChannel(channel);
    };
  }, []);

  // Pull to refresh functionality - Optimized for faster performance
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Refresh timeout')), 10000) // 10 second timeout
      );
      
      await Promise.race([fetchOrders(), timeoutPromise]);
      
      toast({
        title: "Orders Updated!",
        description: "Latest delivery requests loaded",
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast({
        title: "Refresh Failed",
        description: "Unable to fetch latest orders. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
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
                    {location.address ? location.address : 
                     (location.latitude && location.longitude ? 
                       'Location detected' : 
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
                       className={`bg-card border-border hover:shadow-neon hover:scale-[1.02] transition-all duration-300 animate-fade-in ${
                         order.status === 'assigned' ? 'ring-2 ring-primary/30 bg-primary/5' : ''
                       }`}
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
                            {/* Status Badge */}
                            {order.status === 'assigned' && (
                              <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                                <UserCheck className="w-3 h-3 mr-1" />
                                Assigned to You
                              </Badge>
                            )}
                          </div>

                          {/* Delivery Timer */}
                          {(() => {
                            // Determine if order is scheduled based on multiple criteria
                            const isScheduledOrder = Boolean(
                              order.scheduled_time || 
                              order.delivery_date !== new Date().toISOString().split('T')[0] ||
                              order.delivery_time ||
                              order.delivery_slots ||
                              order.subscription_id
                            );
                            
                            const deliveryType = isScheduledOrder ? 'scheduled' : 'immediate';
                            
                            // Debug what we're passing to DeliveryTimer
                            console.log(`Order ${order.id} DeliveryTimer props:`, {
                              deliveryType,
                              hasScheduledTime: Boolean(order.scheduled_time),
                              hasDeliverySlots: Boolean(order.delivery_slots),
                              deliverySlots: order.delivery_slots,
                              deliveryTime: order.delivery_time,
                              subscriptionId: order.subscription_id
                            });
                            
                            return (
                              <div className="mb-4">
                                <DeliveryTimer
                                  deliveryType={deliveryType}
                                  scheduledTime={order.scheduled_time || `${order.delivery_date}T${order.delivery_time || '12:00:00'}`}
                                  orderPlacedAt={order.order_placed_at}
                                  subscriptionId={order.subscription_id}
                                  deliveryTime={order.delivery_time}
                                  deliverySlots={order.delivery_slots}
                                  className="text-xs"
                                />
                              </div>
                            );
                          })()}

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
