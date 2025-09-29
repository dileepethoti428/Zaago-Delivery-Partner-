import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PaymentMethodDialog } from "@/components/PaymentMethodDialog";
import { NavigationMap } from "@/components/NavigationMap";
import { normalizeAddress } from "@/lib/utils";
import { debugAddress } from "@/lib/debugAddress";
import { calculateRealTimeDistance, getAgentLocationFromStorage, extractCoordinatesFromAddress } from "@/lib/distanceService";
import { ArrowLeft, MapPin, Phone, Clock, Calendar, Navigation, CheckCircle2, Package, User, CreditCard, AlertCircle, X } from "lucide-react";
import DeliveryTimer from "@/components/DeliveryTimer";
interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: any;
  original_address?: any; // Keep original address object for coordinate extraction
  items: any[];
  total: number;
  payment_status: string;
  delivery_date: string;
  delivery_time_slot?: string;
  special_instructions?: string;
  status: string;
  created_at: string;
  distance_km?: number;
  backend_calculated?: boolean;
  pickup_location?: any; // Json type from database that contains {lat: number, lng: number}
  pickup_address?: string; // Add pickup address property
  seller_name?: string; // Add seller name property
  seller_phone?: string; // Add seller phone property
  subscription_id?: string;
  calculated_delivery_type?: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later';
  delivery_time?: string;
  agent_id?: string; // Add agent_id property
  delivered_at?: string; // Add delivered_at property
  delivery_slots?: {
    id: string;
    slot_name: string;
    start_time: string;
    end_time: string;
  };
  immediate_timing_config?: {
    max_duration_minutes: number;
    time_slot_start: string;
    time_slot_end: string;
    slot_name: string;
  };
}
const DeliveryDetails = () => {
  const {
    orderId
  } = useParams<{
    orderId: string;
  }>();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showNavigationMap, setShowNavigationMap] = useState(false);
  const [distance, setDistance] = useState<number>(0);
  const [payout, setPayout] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [showForceComplete, setShowForceComplete] = useState(false);
  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);
  useEffect(() => {
    if (order) {
      calculateDistanceAndPayout();
    }
  }, [order]);

  // Real-time distance updates - recalculate every 10 seconds for faster updates
  useEffect(() => {
    if (!order) return;
    
    const updateDistance = () => {
      calculateDistanceAndPayout();
    };
    
    // Initial calculation
    updateDistance();
    
    // Fast real-time updates every 10 seconds
    const interval = setInterval(updateDistance, 10000);
    
    return () => clearInterval(interval);
  }, [order?.id]);

  const calculateDistanceAndPayout = async () => {
    console.log('🧮 Starting fast distance calculation for order:', order?.id);
    if (!order) {
      console.warn('No order data available');
      return;
    }

    // Extract pickup location coordinates from order (handle Json type from database)
    let pickupLocation = null;
    if (order.pickup_location && typeof order.pickup_location === 'object') {
      pickupLocation = {
        lat: order.pickup_location.lat,
        lng: order.pickup_location.lng
      };
    }
    
    if (!pickupLocation || !pickupLocation.lat || !pickupLocation.lng) {
      console.warn('No valid pickup location available in order');
      setDistance(2.5); // fallback
      // Use new rates for fallback: ₹12 for first 1km + ₹8 per km after
      setPayout(Math.round(12 + (2.5 - 1) * 8)); // ₹24 for 2.5km
      return;
    }
    
    // Extract customer coordinates from address object
    const customerCoords = extractCoordinatesFromAddress(order.address);
    if (!customerCoords) {
      console.warn('No customer coordinates available');
      setDistance(2.5); // fallback
      // Use new rates for fallback: ₹12 for first 1km + ₹8 per km after
      setPayout(Math.round(12 + (2.5 - 1) * 8)); // ₹24 for 2.5km
      return;
    }

    try {
      // Use actual pickup-to-customer distance for accurate calculation
      console.log('🚚 Using pickup location:', pickupLocation, 'to customer:', customerCoords);
      const distanceResult = await calculateRealTimeDistance(pickupLocation, customerCoords, order.id);
      let dist = distanceResult.distance_km;
      
      // Ensure minimum distance for deliveries (avoid 0km deliveries)
      if (dist < 0.5) {
        console.log('⚠️ Very short distance detected:', dist, 'km. Using minimum 1km for fair pricing.');
        dist = 1.0; // Minimum 1km for any delivery
      }
      
      // Calculate payout using NEW rates: ₹12 for first 1km, ₹8 per km after
      const basePay = 12; // ₹12 for first 1km
      const perKmRate = 8; // ₹8 per km after first 1km
      const calculatedPayout = dist <= 1 ? basePay : basePay + (dist - 1) * perKmRate;
      
      // Immediate state updates for fast UI response
      setDistance(dist);
      setPayout(Math.round(calculatedPayout));
      
      console.log('✅ Distance calculated:', dist, 'km, Payout:', Math.round(calculatedPayout), 'Source:', distanceResult.source);
    } catch (error) {
      console.error('Error calculating distance:', error);
      // Fast fallback with new rates
      setDistance(2.5);
      // Use new rates: ₹12 for first 1km + ₹8 per km after
      setPayout(Math.round(12 + (2.5 - 1) * 8)); // ₹24 for 2.5km
    }
  };
  const fetchOrderDetails = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (error) throw error;
      if (!data) {
        setOrder(null);
        return;
      }

      // Transform the data to match our interface
      const transformedOrder = {
        ...data,
        items: Array.isArray(data.items) ? data.items : []
      };
      setOrder(transformedOrder);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleNavigation = async () => {
    if (!order?.address) {
      toast({
        title: "Location Error",
        description: "Customer address not available",
        variant: "destructive"
      });
      return;
    }
    let customerLocation = order.address.coordinates;

    // If no coordinates, try to geocode the address
    if (!customerLocation) {
      try {
        const fullAddress = normalizeAddress(order.address);

        // Using a free geocoding service
        const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(fullAddress)}&key=your-api-key&limit=1`);
        if (!response.ok) {
          // Fallback: try with OpenStreetMap Nominatim (free)
          const osmResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`);
          if (osmResponse.ok) {
            const osmData = await osmResponse.json();
            if (osmData && osmData.length > 0) {
              customerLocation = {
                lat: parseFloat(osmData[0].lat),
                lng: parseFloat(osmData[0].lon)
              };
            }
          }
        } else {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            customerLocation = {
              lat: data.results[0].geometry.lat,
              lng: data.results[0].geometry.lng
            };
          }
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      }
    }

    // If still no coordinates, show error
    if (!customerLocation) {
      toast({
        title: "Navigation Unavailable",
        description: "Unable to get customer location. Please use the address details to navigate manually.",
        variant: "destructive"
      });
      return;
    }

    // Update order with coordinates for future use
    if (!order.address.coordinates) {
      order.address.coordinates = customerLocation;
      setOrder({
        ...order
      });
    }

    // Show in-app navigation
    setShowNavigationMap(true);
  };
  const handleMarkAsDelivery = async () => {
    if (!order) return;
    console.log('🎯 Mark as delivery clicked - showing payment dialog');
    console.log('🎯 Order ID:', order.id);

    // Always show payment options (COD and Online) regardless of payment status
    setShowPaymentDialog(true);
  };

  const handleCancelDelivery = async () => {
    if (!order) return;
    setIsCancelling(true);
    try {
      // Get current user and then find agent ID
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user.user?.email) {
        throw new Error('User not authenticated');
      }

      // Get agent ID from delivery_agents table
      const {
        data: agentData,
        error: agentError
      } = await supabase.from('delivery_agents').select('id').eq('email', user.user.email).eq('is_active', true).single();
      if (agentError || !agentData?.id) {
        throw new Error('Agent not found or not active');
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('cancel-delivery', {
        body: {
          order_id: order.id,
          agent_id: agentData.id,
          cancellation_reason: 'Agent cancelled delivery'
        }
      });
      if (error) {
        throw error;
      }
      if (data?.success) {
        toast({
          title: "Delivery Cancelled",
          description: "Order has been released back to all agents"
        });
        // Notify other screens to refresh
        window.dispatchEvent(new CustomEvent('orderCancelled'));
        navigate('/home');
      } else {
        throw new Error(data?.error || 'Failed to cancel delivery');
      }
    } catch (error: any) {
      console.error('Cancel delivery error:', error);
      toast({
        title: "Cancellation Failed",
        description: error?.message || "Unable to cancel delivery. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCancelling(false);
    }
  };
  const completeDeliveryDirect = async (paymentMethod: string) => {
    setIsProcessing(true);
    setDeliveryError(null);
    
    try {
      console.log('🚀 Bypass delivery completion:', { 
        orderId: order?.id, 
        paymentMethod,
        agent_id: order?.agent_id 
      });

      const { data, error } = await supabase.functions.invoke('bypass-complete-delivery', {
        body: {
          order_id: order?.id,
          payment_method: paymentMethod
        }
      });

      if (error) {
        console.error('❌ Bypass function error:', error);
        throw new Error(`Bypass delivery failed: ${error.message}`);
      }

      if (!data || !data.success) {
        console.error('❌ Bypass delivery failed:', data);
        throw new Error(data?.error || 'Bypass delivery failed');
      }

      console.log('🚀 Bypass delivery completed successfully!');
      
      // Update local order state
      const payment_status = paymentMethod === 'COD' ? 'paid_cod' : 'paid_online';
      setOrder(prev => prev ? { 
        ...prev, 
        status: 'delivered', 
        payment_status: payment_status,
        delivered_at: new Date().toISOString()
      } : null);

      // Show success message
      toast({
        title: "🚀 Bypass Delivery Success! 🎉",
        description: `Product delivered via bypass method! Payment: ${paymentMethod}`,
      });

      // Navigate after success
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('orderCompleted'));
        navigate('/home');
      }, 1500);

      return { success: true, message: 'Bypass delivery completed!' };

    } catch (error) {
      console.error('🚀 Bypass delivery error:', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      setDeliveryError(errorMessage);
      
      toast({
        title: "Bypass Delivery Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const forceCompleteDelivery = async (paymentMethod: 'COD' | 'Online') => {
    if (!order) return;

    setIsProcessing(true);
    
    try {
      console.log('🚨 ATTEMPTING FORCE DELIVERY COMPLETION...');
      
      const { data: result, error: edgeError } = await supabase.functions.invoke('force-complete-delivery', {
        body: {
          order_id: order.id,
          payment_method: paymentMethod
        }
      });

      if (edgeError) {
        console.error('❌ Force completion error:', edgeError);
        throw new Error(edgeError.message || 'Force completion failed');
      }

      if (!result?.success) {
        console.error('❌ Force completion failed:', result);
        throw new Error(result?.error || 'Force completion failed');
      }

      console.log('✅ FORCE COMPLETION SUCCESSFUL');

      toast({
        title: "Delivery Force Completed!",
        description: `Order completed using bypass method. Payment marked as ${paymentMethod}.`,
        variant: "default",
      });

      navigate('/home');

    } catch (error) {
      console.error('❌ Force completion error:', error);
      toast({
        title: "Force Completion Failed",
        description: error instanceof Error ? error.message : "Failed to force complete delivery",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryDelivery = () => {
    setDeliveryError(null);
    setIsProcessing(false);
  };

  // Nuclear option - bypasses ALL API layers with direct PostgreSQL
  const nuclearCompleteDelivery = async (paymentMethod: 'COD' | 'Online') => {
    if (!order) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `🚨 EMERGENCY NUCLEAR BYPASS 🚨\n\n` +
      `This will bypass ALL Supabase API layers and use direct PostgreSQL connection.\n\n` +
      `This method bypasses JSON validation that's causing failures.\n\n` +
      `Payment Method: ${paymentMethod}\n` +
      `Order ID: ${order.id}\n\n` +
      `Are you absolutely sure you want to proceed?`
    );

    if (!confirmed) return;

    setIsProcessing(true);

    try {
      console.log('💥 NUCLEAR POSTGRESQL BYPASS INITIATED:', {
        orderId: order.id,
        paymentMethod,
        timestamp: new Date().toISOString()
      });

      // Get current user for agent email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('User authentication required for nuclear bypass');
      }

      const { data, error } = await supabase.functions.invoke('nuclear-complete-delivery', {
        body: {
          order_id: order.id,
          payment_method: paymentMethod,
          agent_email: user.email
        }
      });

      if (error) {
        console.error('💥 Nuclear PostgreSQL bypass failed:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('💥 Nuclear bypass returned failure:', data);
        throw new Error(data?.error || 'Nuclear PostgreSQL bypass failed');
      }

      console.log('🚀 NUCLEAR POSTGRESQL BYPASS SUCCESSFUL:', data);

      toast({
        title: "💥 Emergency Bypass Successful!",
        description: `Order completed via direct PostgreSQL bypass. Payment: ${paymentMethod}. Payout: ₹${data.payout_amount}`,
        variant: "default",
      });

      // Update local order state
      setOrder(prev => prev ? { 
        ...prev, 
        status: 'delivered', 
        payment_status: paymentMethod === 'COD' ? 'paid_cod' : 'paid_online',
        delivered_at: new Date().toISOString()
      } : null);

      // Clear error state and redirect
      setDeliveryError(null);
      setIsProcessing(false);
      
      // Redirect to home after short delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('orderCompleted'));
        navigate('/home');
      }, 2000);

    } catch (error: any) {
      console.error('💥 Nuclear PostgreSQL bypass failed:', error);
      
      toast({
        title: "💥 Nuclear Bypass Failed",
        description: error.message || 'Even the nuclear PostgreSQL bypass failed. All methods exhausted.',
        variant: "destructive",
      });

      setIsProcessing(false);
      // Don't clear deliveryError - keep showing all options
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading order details...</p>
        </div>
      </div>;
  }
  if (!order) {
    return <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Order not found</p>
        </div>
      </div>;
  }
  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'paid_online':
      case 'paid_subscription':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'paid_cod':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };
  const getPaymentStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid_online':
        return 'PAID ONLINE';
      case 'paid_cod':
        return 'PAID COD';
      case 'paid_subscription':
        return 'PAID SUBSCRIPTION';
      case 'paid':
        return 'PAID';
      case 'pending':
        return 'PENDING';
      default:
        return status.toUpperCase().replace('_', ' ');
    }
  };
  return <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4 animate-fade-in">
        <Button variant="ghost" size="icon" onClick={() => navigate('/home')} className="hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Delivery Details</h1>
          <p className="text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2 animate-slide-up">
        <Badge variant="outline" className="border-primary/20">
          PENDING
        </Badge>
        <Badge className={`${getPaymentStatusColor(order.payment_status)} border-0`}>
          {getPaymentStatusText(order.payment_status)}
        </Badge>
      </div>

      {/* Customer Information */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center space-x-2 text-sm">
            <User className="w-4 h-4 text-primary" />
            <span>Customer Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Customer Name</p>
              <p className="text-sm font-medium text-foreground">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Delivery Address</p>
              <div className="flex items-start space-x-1">
                <MapPin className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  {debugAddress(order.address, 'delivery-details')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Contact Number</p>
              <div className="flex items-center space-x-1">
                <Phone className="w-3 h-3 text-primary" />
                <p className="text-sm font-medium text-foreground">{order.customer_phone}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Order Date</p>
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {order.delivery_time_slot && <div>
              <p className="text-xs text-muted-foreground">Time Slot</p>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-primary" />
                <p className="text-sm font-medium text-foreground">{order.delivery_time_slot}</p>
              </div>
            </div>}
        </CardContent>
      </Card>

      {/* Pickup Information - NEW */}
      {order.pickup_location && (
        <Card className="bg-card border-border animate-slide-up border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-sm">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span>Pickup Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            <div className="grid grid-cols-1 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Store/Seller</p>
                <p className="text-sm font-medium text-foreground">
                  {order.seller_name || 'Store Name Not Available'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pickup Address</p>
                <div className="flex items-start space-x-1">
                  <MapPin className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium text-foreground">
                    {normalizeAddress(order.pickup_address) || 'Pickup Location Not Available'}
                  </p>
                </div>
              </div>
              {order.seller_phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Store Contact</p>
                  <div className="flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-orange-500" />
                    <p className="text-sm font-medium text-foreground">{order.seller_phone}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const { lat, lng } = order.pickup_location as any;
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                  window.open(googleMapsUrl, '_blank');
                }}
                className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <Navigation className="w-3 h-3 mr-1" />
                Navigate to Store
              </Button>
              {order.seller_phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`tel:${order.seller_phone}`)}
                  className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <Phone className="w-3 h-3 mr-1" />
                  Call Store
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Timer */}
      <div className="animate-slide-up">
        {(() => {
          // Determine delivery type based on actual database fields only
          let determinedType: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later';
          
          if (order.subscription_id) {
            determinedType = 'subscription';
          } else if (order.delivery_time_slot && order.delivery_time_slot.includes('-')) {
            determinedType = 'scheduled';
          } else {
            determinedType = 'immediate';
          }
          
          console.log('🔍 DeliveryDetails - Fixed Delivery Type Logic:', {
            subscription_id: order.subscription_id,
            delivery_time_slot: order.delivery_time_slot,
            hasHyphen: order.delivery_time_slot && order.delivery_time_slot.includes('-'),
            determinedType: determinedType,
            orderData: {
              id: order.id,
              customer_name: order.customer_name,
              payment_status: order.payment_status
            }
          });
          
          return (
            <DeliveryTimer
              deliveryType={determinedType}
              scheduledTime={order.delivery_date}
              orderPlacedAt={new Date(order.created_at)}
              subscriptionId={order.subscription_id}
              deliveryTime={order.delivery_time}
              deliverySlots={order.delivery_slots}
              paymentStatus={order.payment_status}
              deliveryTimeSlot={order.delivery_time_slot}
              immediateTimingConfig={order.immediate_timing_config}
              acceptedAt={new Date()} // Use current time as acceptance time since agent is viewing details
              scheduledTimingConfig={{ max_duration_minutes: 20 }} // 20 minutes for scheduled orders after acceptance
              className="w-full"
            />
          );
        })()}
      </div>

      {/* Order Details */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center space-x-2 text-sm">
            <Package className="w-4 h-4 text-primary" />
            <span>Order Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {order.items?.map((item: any, index: number) => <div key={index} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                  <Package className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name || 'Product'}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity || 1}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-foreground">₹{item.price || item.total || order.total}</p>
            </div>)}
          
          <div className="border-t border-border pt-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-foreground">Total Amount</p>
              <p className="text-base font-bold text-primary">₹{order.total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Distance & Payout Details */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-3">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center space-x-1">
              <Navigation className="w-3 h-3 text-primary" />
              <span>DELIVERY DETAILS</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 bg-secondary/20 rounded-lg border border-green-200">
                <p className="text-xs text-muted-foreground flex items-center justify-center">
                  <span>Fast Real-time Distance</span>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1 animate-pulse" title="Updates every 10 seconds"></div>
                </p>
                <p className="text-sm font-bold text-primary flex items-center justify-center">
                  {distance > 0 ? (
                    <>
                      <span>{distance.toFixed(1)} km</span>
                      <span className="text-xs text-green-600 ml-1">(Live)</span>
                    </>
                  ) : (
                    <div className="flex items-center">
                      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1"></div>
                      <span>Updating...</span>
                    </div>
                  )}
                </p>
              </div>
              <div className="text-center p-2 bg-secondary/20 rounded-lg border border-green-200">
                <p className="text-xs text-muted-foreground">Your Payout</p>
                <p className="text-sm font-bold text-green-500 flex items-center justify-center">
                  <span>₹{Math.round(payout)}</span>
                  {distance > 0 && (
                    <span className="text-xs text-green-600 ml-1">(Live)</span>
                  )}
                </p>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Payment Details */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-3">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center space-x-1">
              <CreditCard className="w-3 h-3 text-primary" />
              <span>PAYMENT DETAILS</span>
            </h3>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">Payment Status:</span>
              <Badge className={`${getPaymentStatusColor(order.payment_status)} border-0 text-xs`}>
                {getPaymentStatusText(order.payment_status)}
              </Badge>
            </div>

            {order.payment_status === 'paid' || order.payment_status === 'paid_online' ? <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-xs text-green-600 dark:text-green-400">
                  Order is already paid online
                </p>
              </div> : <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Payment pending - collect on delivery
                </p>
              </div>}
          </div>
        </CardContent>
       </Card>

      {/* Action Buttons */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-3">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-primary" />
              <span>DELIVERY ACTIONS</span>
            </h3>
            
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1">
                <Button variant="outline" className="flex items-center justify-center space-x-1 h-8 border-border hover:bg-secondary px-2" onClick={handleNavigation}>
                  <Navigation className="w-3 h-3" />
                  <span className="text-xs">Navigate to Customer</span>
                </Button>
                
                <Button className="flex items-center justify-center space-x-1 h-8 bg-gradient-neon hover:shadow-neon transition-smooth px-2 -ml-1" onClick={handleMarkAsDelivery} disabled={isProcessing}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-xs">{isProcessing ? 'Processing...' : 'Mark as Delivered'}</span>
                </Button>
              </div>

              <Button variant="destructive" className="w-full flex items-center justify-center space-x-2 h-8" onClick={handleCancelDelivery} disabled={isCancelling}>
                <X className="w-3 h-3" />
                <span className="text-sm">{isCancelling ? 'Cancelling...' : 'Cancel Delivery'}</span>
              </Button>

              {/* Show error message and force complete option */}
              {deliveryError && showForceComplete && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 space-y-3">
                  <div className="text-red-800 text-sm mb-2">
                    <strong>⚠️ Normal completion failed:</strong> {deliveryError}
                  </div>
                  <div className="text-red-700 text-xs mb-3">
                    This order may have corrupted data. Try Force Complete first.
                  </div>
                  
                  {/* Regular Force Complete Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => forceCompleteDelivery('COD')} 
                      variant="destructive"
                      size="sm"
                      disabled={isProcessing}
                      className="text-xs bg-orange-600 hover:bg-orange-700"
                    >
                      🚨 Force Complete (COD)
                    </Button>
                    <Button 
                      onClick={() => forceCompleteDelivery('Online')} 
                      variant="destructive"
                      size="sm"
                      disabled={isProcessing}
                      className="text-xs bg-orange-600 hover:bg-orange-700"
                    >
                      🚨 Force Complete (Online)
                    </Button>
                  </div>
                  
                  {/* Nuclear Option - Direct PostgreSQL Bypass */}
                  <div className="border-t pt-3">
                    <div className="text-red-800 text-xs mb-2 text-center font-bold">
                      💥 EMERGENCY POSTGRESQL BYPASS - Use only if Force Complete also fails
                    </div>
                    <div className="text-red-700 text-xs mb-2 text-center">
                      Bypasses all API layers and uses direct database connection
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={() => nuclearCompleteDelivery('COD')} 
                        variant="destructive"
                        size="sm"
                        disabled={isProcessing}
                        className="text-xs bg-red-700 hover:bg-red-800 border-2 border-red-800"
                      >
                        💥 Emergency COD
                      </Button>
                      <Button 
                        onClick={() => nuclearCompleteDelivery('Online')} 
                        variant="destructive"
                        size="sm"
                        disabled={isProcessing}
                        className="text-xs bg-red-700 hover:bg-red-800 border-2 border-red-800"
                      >
                        💥 Emergency Online
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Instructions */}
      {order.special_instructions && <Card className="bg-card border-border animate-slide-up">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-2">Special Instructions</h3>
            <p className="text-muted-foreground">{order.special_instructions}</p>
          </CardContent>
        </Card>}

      {/* Payment Method Dialog */}
      {order && <PaymentMethodDialog 
        open={showPaymentDialog} 
        onOpenChange={setShowPaymentDialog} 
        selectionOnly={true}
        error={deliveryError}
        onRetry={handleRetryDelivery}
        order={{
          order_id: order.id,
          customer_name: order.customer_name,
          total_amount: order.total,
          payment_status: order.payment_status
        }} 
        onSuccess={async (paymentMethod) => {
          await completeDeliveryDirect(paymentMethod);
        }}
      />}

      {/* Navigation Map */}
      {order && <NavigationMap open={showNavigationMap} onOpenChange={setShowNavigationMap} customerLocation={order.address?.coordinates || {
      lat: 31.33,
      lng: 75.57
    }} customerAddress={debugAddress(order.address, 'delivery-details-map')} customerName={order.customer_name} customerPhone={order.customer_phone} />}
    </div>;
};
export default DeliveryDetails;