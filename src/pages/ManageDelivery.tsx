import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/StatusPill';
import { toast } from '@/hooks/use-toast';
import { getOrderDetails, type OrderDetails } from '@/services/orderDetails';
import { openGoogleMapsAddress } from '@/utils/maps';
import { useAuthStore } from '@/store/auth';
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Package, 
  CheckCircle, 
  XCircle, 
  Clock,
  IndianRupee,
  User,
  Store,
  Copy,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { PaymentMethodDialog } from '@/components/delivery/PaymentMethodDialog';
import { RazorpayQRDisplay } from '@/components/delivery/RazorpayQRDisplay';

export default function ManageDelivery() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const profile = useAuthStore((state) => state.profile);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrData, setQRData] = useState<any>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await getOrderDetails(id);
        setOrder(data);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message || 'Failed to load order details',
        });
        navigate('/home');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, navigate]);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleMarkAsDelivered = async () => {
    if (!order) return;

    // Step 1: Check if already paid
    if (order.payment_status === 'paid' || order.payment_method?.toUpperCase() === 'ONLINE') {
      // Complete directly
      await completeDelivery('ONLINE');
      return;
    }

    // Step 2: Show payment method selection dialog
    setShowPaymentDialog(true);
  };

  const handlePaymentMethodSelect = async (method: 'COD' | 'ONLINE') => {
    setShowPaymentDialog(false);
    
    if (method === 'COD') {
      // Complete with COD
      await completeDelivery('COD');
    } else {
      // Generate QR and show dialog
      await generateAndShowQR();
    }
  };

  const generateAndShowQR = async () => {
    if (!order) return;

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('generate-payment-qr', {
        body: {
          order_id: order.id,
          amount: order.total_amount,
          customer_name: order.customer.name
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to generate QR code');
      }

      setQRData(data);
      setShowQRDialog(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to generate payment QR',
      });
    }
  };

  const completeDelivery = async (paymentMethod: 'COD' | 'ONLINE') => {
    if (!order) return;

    setIsCompleting(true);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('unified-complete-delivery', {
        body: {
          order_id: order.id,
          payment_method: paymentMethod,
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to complete delivery');
      }

      // Show success message based on payment method
      const successMessage = paymentMethod === 'COD' 
        ? 'Product delivered successfully - COD ✓'
        : 'Product delivered successfully - Paid Online ✓';
      
      toast({
        title: 'Delivery Completed!',
        description: successMessage,
      });
      
      // Navigate back after a short delay
      setTimeout(() => navigate('/home'), 1500);
      
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to complete delivery',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleQRPaymentComplete = async () => {
    setShowQRDialog(false);
    await completeDelivery('ONLINE');
  };

  const handleCancel = async () => {
    if (!order || !profile?.user_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User profile not found',
      });
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel this delivery? It will be released back to other agents.'
    );
    
    if (!confirmed) return;

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('cancel-delivery', {
        body: {
          order_id: order.id,
          agent_id: profile.user_id,
          cancellation_reason: 'Agent cancelled from manage delivery page'
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to cancel delivery');
      }

      toast({
        title: 'Delivery Cancelled',
        description: 'Order has been cancelled successfully',
      });
      
      navigate('/home');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to cancel delivery',
      });
    }
  };

  if (loading) {
    return (
      <AppShell showTabBar={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading order details...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell showTabBar={false}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Order not found</p>
          <Button onClick={() => navigate('/home')}>Back to Home</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <motion.div 
      initial={pageTransition.initial} 
      animate={pageTransition.animate} 
      exit={pageTransition.exit} 
      transition={pageTransitionConfig}
      className="h-full"
    >
      <AppShell showTabBar={false}>
        <div className="space-y-4 py-4 pb-24">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/home')}
              className="rounded-xl"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Manage Delivery</h1>
              <StatusPill status={order.status} />
            </div>
          </div>

          {/* Delivery Information */}
          <Card className="rounded-2xl border-2 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <span className="font-medium uppercase">{order.payment_method}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment Status</span>
                <StatusPill status={order.payment_status} />
              </div>
              {order.subscription_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Order Type</span>
                  <Badge variant="secondary" className="rounded-lg">
                    Subscription Order
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Details */}
          <Card className="rounded-2xl border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Name</p>
                <p className="font-medium">{order.customer.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Phone</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCall(order.customer.phone)}
                  className="gap-2 rounded-xl w-full justify-start"
                >
                  <Phone className="h-4 w-4" />
                  {order.customer.phone}
                </Button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivery Address</p>
                <p className="text-sm mb-2">{order.customer.address || 'Not available'}</p>
                {order.customer.address && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openGoogleMapsAddress(order.customer.address)}
                    className="gap-2 rounded-xl w-full mt-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Maps
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Seller/Pickup Details */}
          <Card className="rounded-2xl border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="h-4 w-4" />
                Pickup Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Seller Name</p>
                <p className="font-medium">{order.seller.name || 'N/A'}</p>
              </div>
              {order.seller.phone && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCall(order.seller.phone)}
                    className="gap-2 rounded-xl w-full justify-start"
                  >
                    <Phone className="h-4 w-4" />
                    {order.seller.phone}
                  </Button>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pickup Address</p>
                <p className="text-sm mb-2">{order.seller.address || 'Not available'}</p>
                {order.seller.address && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openGoogleMapsAddress(order.seller.address)}
                    className="gap-2 rounded-xl w-full"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Maps
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card className="rounded-2xl border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.product_name || item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium">₹{item.price * item.quantity}</p>
                </div>
              ))}
              <div className="pt-3 border-t-2 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    ₹{order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-bold">Total Amount</span>
                  <span className="font-bold text-lg text-primary">₹{order.total_amount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.special_instructions && (
            <Card className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Special Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{order.special_instructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="default"
                className="rounded-xl h-12 text-base font-medium"
                onClick={() => openGoogleMapsAddress(order.customer.address)}
              >
                <Navigation className="h-5 w-5 mr-2" />
                Navigate to Customer
              </Button>
              <Button
                className="rounded-xl h-12 text-base font-medium"
                onClick={handleMarkAsDelivered}
                disabled={!['assigned', 'picked_up'].includes(order.status) || isCompleting}
              >
                {isCompleting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Mark as Delivered
                  </>
                )}
              </Button>
            </div>
            <Button
              variant="destructive"
              className="w-full rounded-xl h-12 text-base font-medium"
              onClick={handleCancel}
              disabled={!['assigned', 'picked_up'].includes(order.status)}
            >
              <XCircle className="h-5 w-5 mr-2" />
              Cancel Delivery
            </Button>
          </div>
        </div>

        {/* Payment Method Selection Dialog */}
        <PaymentMethodDialog
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onSelectMethod={handlePaymentMethodSelect}
          amount={order.total_amount}
        />

        {/* Razorpay QR Code Display */}
        <RazorpayQRDisplay
          open={showQRDialog}
          onClose={() => setShowQRDialog(false)}
          qrData={qrData}
          orderAmount={order.total_amount}
          onPaymentComplete={handleQRPaymentComplete}
        />
      </AppShell>
    </motion.div>
  );
}
