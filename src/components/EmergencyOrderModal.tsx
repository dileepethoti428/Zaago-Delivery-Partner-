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
  AlertTriangle,
  Bell,
  Volume2,
  Navigation,
  TrendingUp,
  Zap
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
  const [showAudioControls, setShowAudioControls] = useState(false);

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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto p-0 gap-0 overflow-hidden border-0 bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 shadow-2xl animate-in slide-in-from-top-4 duration-500">
        {/* Pulsing Border Animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse opacity-20 pointer-events-none" />
        
        {/* Countdown Progress Ring */}
        <div className="absolute top-4 right-4 z-20">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-red-200"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - countdown / 30)}`}
                className="text-red-600 transition-all duration-1000 ease-linear"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-red-600">{countdown}</span>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 left-4 z-20 text-gray-600 hover:text-gray-900 rounded-full h-8 w-8 p-0 bg-white/80 hover:bg-white"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Animated Header with Icon */}
        <div className="relative pt-6 pb-4 px-4">
          <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-700">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
              <div className="relative bg-gradient-to-br from-red-500 to-orange-600 p-4 rounded-full shadow-lg">
                <Bell className="h-8 w-8 text-white animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-1">NEW ORDER!</h2>
              <Badge className="bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold px-4 py-1 rounded-full shadow-lg animate-pulse">
                IMMEDIATE ACTION REQUIRED
              </Badge>
            </div>
          </div>
        </div>

        {/* Earnings Highlight - Rapido Style */}
        <div className="mx-4 mb-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 shadow-lg animate-in slide-in-from-left duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-white/80 font-medium">You'll Earn</p>
                <p className="text-2xl font-bold text-white flex items-center gap-1">
                  <IndianRupee className="h-5 w-5" />
                  {orderData.total}
                </p>
              </div>
            </div>
            <div className="bg-white/20 px-3 py-1 rounded-full">
              <p className="text-xs text-white font-semibold flex items-center gap-1">
                <Zap className="h-3 w-3" />
                FAST PAY
              </p>
            </div>
          </div>
        </div>

        {/* Order Details Card */}
        <div className="mx-4 mb-3 bg-white rounded-xl p-4 shadow-md border border-gray-100 animate-in slide-in-from-right duration-500">
          <div className="space-y-3">
            {/* Order ID and Time */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 font-medium">Order ID</p>
                <p className="text-sm font-bold text-gray-900">#{orderData.id.slice(-8).toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">Time</p>
                <p className="text-sm font-semibold text-gray-900">{formatTime(orderData.created_at)}</p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="flex items-start gap-3">
              <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Customer</p>
                <p className="text-sm font-bold text-gray-900 truncate">{orderData.customer_name}</p>
                <p className="text-xs text-gray-600">{orderData.customer_phone}</p>
              </div>
            </div>

            {/* Items */}
            <div className="flex items-start gap-3">
              <div className="bg-purple-50 p-2 rounded-lg flex-shrink-0">
                <Package className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Items</p>
                <p className="text-sm text-gray-900 line-clamp-2">{formatItems(orderData.items)}</p>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="flex items-start gap-3">
              <div className="bg-orange-50 p-2 rounded-lg flex-shrink-0">
                <MapPin className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Delivery Address</p>
                <p className="text-sm text-gray-900 line-clamp-2">{orderData.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Audio Alert Banner */}
        <div className="mx-4 mb-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-xl p-3 shadow-md animate-pulse">
          <div className="flex items-center justify-center gap-2">
            <Volume2 className="h-5 w-5 text-white animate-bounce" />
            <span className="font-bold text-white text-sm">LOUD ALERT PLAYING</span>
            <Volume2 className="h-5 w-5 text-white animate-bounce" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-4 space-y-2">
          {/* Primary Action - Accept */}
          <Button
            onClick={handleAcceptOrder}
            disabled={isAccepting}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
          >
            {isAccepting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-lg">Accepting...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span className="text-lg">ACCEPT ORDER</span>
              </div>
            )}
          </Button>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={onStopAlarm}
              variant="outline"
              className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-semibold py-3 rounded-xl"
            >
              <VolumeX className="h-4 w-4 mr-2" />
              STOP ALARM
            </Button>
            
            <Button
              onClick={handleViewDetails}
              variant="outline"
              className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold py-3 rounded-xl"
            >
              <Eye className="h-4 w-4 mr-2" />
              DETAILS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};