import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  IndianRupee, 
  Package, 
  Navigation,
  Loader2,
  CheckCircle,
  X,
  Settings
} from "lucide-react";
import { debugAddress } from "@/lib/debugAddress";
import { normalizeAddress } from "@/lib/utils";
import { parseDeliverySlots } from "@/lib/deliverySlotParser";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DeliveryTimer from "@/components/DeliveryTimer";

interface OrderCardProps {
  order: any;
  isLoadingDistance: boolean;
  acceptingOrders: Record<string, boolean>;
  rejectingOrders: Record<string, boolean>;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  calculateAgentPayout: (distance: number) => number;
}

// Memoized OrderCard component - only re-renders when props change
export const OrderCard = memo(({ 
  order, 
  isLoadingDistance, 
  acceptingOrders, 
  rejectingOrders,
  onAccept,
  onReject,
  calculateAgentPayout
}: OrderCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handlePickupClick = async () => {
    if (order.pickup_location) {
      const { lat, lng } = order.pickup_location;
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(googleMapsUrl, '_blank');
    } else if (order.pickup_address) {
      const safePickupAddress = normalizeAddress(order.pickup_address);
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
  };

  const handleDeliveryClick = () => {
    const address = debugAddress(order.address, `order-${order.id}-maps`);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
    window.open(googleMapsUrl, '_blank');
  };

  // Pre-calculate delivery slots (memoized in parent)
  const deliverySlots = parseDeliverySlots(order);

  return (
    <div 
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
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center cursor-pointer transition-colors min-h-[36px] w-[140px] justify-center"
            onClick={handlePickupClick}
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
          deliveryType={(order as any).calculated_delivery_type || (order.subscription_id ? 'subscription' : (order.delivery_time_slot && order.delivery_time_slot.includes('-') ? 'scheduled' : 'immediate'))}
          orderPlacedAt={new Date((order as any).original_created_at || order.created_at)}
          deliveryTimeSlot={order.delivery_time_slot}
          deliverySlots={deliverySlots}
          paymentStatus={order.payment_status}
          subscriptionId={order.subscription_id}
          immediateTimingConfig={(order as any).immediate_timing_config}
        />
      </div>

      {/* Address */}
      <div className="flex items-start mb-4">
        <MapPin className="w-4 h-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
        <div className="flex-1">
          <div 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center cursor-pointer transition-colors min-h-[36px] w-[140px] justify-center"
            onClick={handleDeliveryClick}
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
                  <span>{`${order.agent_to_shop_distance ? order.agent_to_shop_distance.toFixed(1) : '2.0'} km away`}</span>
                  <div className="w-2 h-2 bg-green-400 rounded-full ml-2 animate-pulse" title="Real-time tracking"></div>
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
              ₹{order.agent_payout ?? calculateAgentPayout(order.distance_km || 2.5)}
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

      {/* Action Buttons */}
      {order.status === 'assigned' || order.status === 'out_for_delivery' ? (
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
            onClick={() => onAccept(order.id)}
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
            onClick={() => onReject(order.id)}
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
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these specific props change
  return (
    prevProps.order.id === nextProps.order.id &&
    prevProps.order.status === nextProps.order.status &&
    prevProps.order.agent_to_shop_distance === nextProps.order.agent_to_shop_distance &&
    prevProps.order.distance_km === nextProps.order.distance_km &&
    prevProps.order.agent_payout === nextProps.order.agent_payout &&
    prevProps.isLoadingDistance === nextProps.isLoadingDistance &&
    prevProps.acceptingOrders[prevProps.order.id] === nextProps.acceptingOrders[nextProps.order.id] &&
    prevProps.rejectingOrders[prevProps.order.id] === nextProps.rejectingOrders[nextProps.order.id]
  );
});

OrderCard.displayName = 'OrderCard';
