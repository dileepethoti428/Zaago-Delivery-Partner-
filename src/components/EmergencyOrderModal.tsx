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
  ChevronDown
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
      <DialogContent className="max-w-md mx-auto p-0 gap-0 bg-white border-4 border-red-500 shadow-2xl">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 text-gray-500 hover:text-gray-700 rounded-full h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Emergency Header */}
        <div className="bg-red-100 border-2 border-red-400 rounded-lg m-4 p-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-6 w-6 text-red-600" />
              <div>
                <h2 className="text-xl font-bold text-red-600">NEW ORDER!</h2>
                <p className="text-sm text-red-600 font-medium">IMMEDIATE ACTION REQUIRED</p>
              </div>
            </div>
            <Badge className="bg-red-600 text-white font-bold px-3 py-1 rounded-full">
              EMERGENCY
            </Badge>
          </div>
        </div>

        {/* Order Details */}
        <div className="px-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Order ID:</p>
              <p className="font-bold">#{orderData.id.slice(-6).toUpperCase()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Amount:</p>
              <p className="font-bold text-lg">₹{orderData.total}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Customer:</p>
            <p className="font-bold">{orderData.customer_name}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Items:</p>
            <p className="text-blue-600">{formatItems(orderData.items)}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Address:</p>
            <p className="text-blue-600">{orderData.address}</p>
          </div>
        </div>

        {/* Audio Alert Section */}
        <div className="mx-4 my-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Volume2 className="h-5 w-5 text-yellow-700" />
            <span className="font-bold text-yellow-700">LOUD RINGTONE PLAYING</span>
            <Volume2 className="h-5 w-5 text-yellow-700" />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={onStopAlarm}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
            >
              <VolumeX className="h-4 w-4 mr-2" />
              STOP ALARM
            </Button>
            
            <Button
              onClick={onClose}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              <X className="h-4 w-4 mr-2" />
              DISMISS
            </Button>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="mx-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => setShowAudioControls(!showAudioControls)}
            className="w-full justify-between p-2 text-gray-700"
          >
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <span>Audio Controls</span>
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAudioControls ? 'rotate-180' : ''}`} />
          </Button>
          {showAudioControls && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Audio controls would go here</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleAcceptOrder}
              disabled={isAccepting}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-md"
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
              className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 font-bold py-3 rounded-md"
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>VIEW DETAILS</span>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};