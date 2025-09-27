import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Package, 
  MapPin, 
  Phone, 
  IndianRupee, 
  Clock, 
  User,
  X,
  CheckCircle,
  Eye,
  VolumeX,
  AlertTriangle
} from 'lucide-react';

interface OrderData {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  items: any[];
  total: number;
  created_at: string;
  pickup_address?: string;
  seller_name?: string;
  seller_phone?: string;
}

interface EmergencyOrderModalProps {
  isOpen: boolean;
  orderData: OrderData | null;
  onClose: () => void;
  onAccept: (orderId: string) => void;
  onStopAlarm: () => void;
}

export const EmergencyOrderModal: React.FC<EmergencyOrderModalProps> = ({
  isOpen,
  orderData,
  onClose,
  onAccept,
  onStopAlarm
}) => {
  const { toast } = useToast();
  const [isAccepting, setIsAccepting] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!isOpen || !orderData) return;

    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, orderData, onClose]);

  const handleAcceptOrder = async () => {
    if (!orderData) return;

    setIsAccepting(true);
    try {
      await onAccept(orderData.id);
      onClose();
      toast({
        title: "Order Accepted! 🎉",
        description: `You've accepted order from ${orderData.customer_name}`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error accepting order:', error);
      toast({
        title: "Error",
        description: "Failed to accept order. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleViewDetails = () => {
    if (orderData) {
      window.location.href = `/order-details/${orderData.id}`;
    }
  };

  if (!orderData) return null;

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatItems = (items: any[]) => {
    if (!Array.isArray(items)) return 'Order items';
    return items.map(item => `${item.name || item.product_name || 'Item'} (${item.quantity || 1}x)`).join(', ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto p-0 gap-0 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-500 shadow-2xl animate-pulse">
        {/* Emergency Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 animate-bounce" />
              <div>
                <h2 className="text-lg font-bold">🚨 URGENT ORDER READY!</h2>
                <p className="text-sm opacity-90">Order Packed & Ready for Pickup</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-red-500 rounded-full h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Countdown Timer */}
          <div className="mt-2 text-center">
            <Badge variant="secondary" className="bg-white/20 text-white animate-pulse">
              Auto-dismiss in {countdown}s
            </Badge>
          </div>
        </div>

        {/* Order Details */}
        <div className="p-4 space-y-3">
          {/* Customer Info */}
          <div className="bg-white rounded-lg p-3 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-red-600" />
              <span className="font-semibold text-red-800">Customer</span>
            </div>
            <p className="font-medium">{orderData.customer_name}</p>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Phone className="h-3 w-3" />
              <span>{orderData.customer_phone}</span>
            </div>
          </div>

          {/* Order Info */}
          <div className="bg-white rounded-lg p-3 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-red-800">Order #{orderData.id.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1 text-green-600 font-semibold">
                <IndianRupee className="h-4 w-4" />
                <span>₹{orderData.total}</span>
              </div>
            </div>
            <p className="text-sm text-gray-600">{formatItems(orderData.items)}</p>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Clock className="h-3 w-3" />
              <span>Ordered at {formatTime(orderData.created_at)}</span>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-lg p-3 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-red-600" />
              <span className="font-semibold text-red-800">Delivery Address</span>
            </div>
            <p className="text-sm text-gray-700">{orderData.address}</p>
          </div>

          {/* Pickup Location */}
          {orderData.pickup_address && (
            <div className="bg-white rounded-lg p-3 border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-red-800">Pickup From</span>
              </div>
              <p className="text-sm text-gray-700">{orderData.pickup_address}</p>
              {orderData.seller_name && (
                <p className="text-xs text-gray-500 mt-1">
                  Seller: {orderData.seller_name}
                  {orderData.seller_phone && ` (${orderData.seller_phone})`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-gray-50 border-t space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleAcceptOrder}
              disabled={isAccepting}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 shadow-lg"
            >
              {isAccepting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Accepting...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>ACCEPT ORDER</span>
                </div>
              )}
            </Button>
            
            <Button
              onClick={handleViewDetails}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 font-semibold py-3"
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>VIEW DETAILS</span>
              </div>
            </Button>
          </div>
          
          <Button
            onClick={onStopAlarm}
            variant="outline"
            className="w-full border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            <div className="flex items-center gap-2">
              <VolumeX className="h-4 w-4" />
              <span>Stop Alarm</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};