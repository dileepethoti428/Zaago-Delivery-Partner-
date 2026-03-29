import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/StatusPill';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getOrderDetails } from '@/services/orderDetails';
import { openGoogleMapsAddress, openGoogleMapsCoordinates } from '@/utils/maps';
import { useAuthStore } from '@/store/auth';
import { useState } from 'react';
import { 
  ArrowLeft, 
  Phone, 
  Package, 
  CheckCircle, 
  XCircle, 
  User,
  Store,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { PaymentMethodDialog } from '@/components/delivery/PaymentMethodDialog';
import { RazorpayQRDisplay } from '@/components/delivery/RazorpayQRDisplay';

export default function ManageDelivery() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrData, setQRData] = useState<any>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  const orderType = searchParams.get('type') === 'daily' ? 'daily' : 'order';

  // ✅ React Query replaces manual fetchOrder + retry loop — pause/resume safe
  const { data: order, isLoading: loading } = useQuery({
    queryKey: ['order-details', id, orderType],
    queryFn: () => getOrderDetails(id!, { type: orderType }),
    enabled: !!id,
    retry: 2,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const itemsTotal = useMemo(() =>
    order?.items?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) ?? 0,
    [order?.items]
  );

  const effectiveTotal = useMemo(() =>
    (order?.total_amount && order.total_amount > 0) ? order.total_amount : itemsTotal,
    [order?.total_amount, itemsTotal]
  );

  const displayAddress = useMemo(() => {
    if (!order) return '';
    return (
      order.customer.address ||
      [order.customer.landmark, order.customer.city, order.customer.state, order.customer.pincode]
        .filter(Boolean)
        .join(', ') ||
      ''
    );
  }, [order]);

  const isTerminalState = useMemo(() => {
    if (!order) return false;
    return ['delivered', 'cancelled', 'canceled', 'completed'].includes(order.status?.toLowerCase());
  }, [order?.status]);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleMarkAsDelivered = async () => {
    if (!order) return;
    if (order.payment_status === 'paid' || order.payment_method?.toUpperCase() === 'ONLINE') {
      toast({ title: 'Product delivered successfully' });
      await completeDelivery('ONLINE');
      return;
    }
    setShowPaymentDialog(true);
  };

  const handlePaymentMethodSelect = async (method: 'COD' | 'ONLINE') => {
    setShowPaymentDialog(false);
    if (method === 'COD') {
      toast({ title: 'Product delivered successfully - COD' });
      await completeDelivery('COD');
    } else {
      await generateAndShowQR();
    }
  };

  const generateAndShowQR = async () => {
    if (!order) return;
    const amountToPay = effectiveTotal;
    if (amountToPay <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Invalid order amount. Cannot generate QR code.' });
      return;
    }
    setIsGeneratingQR(true);
    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke('generate-payment-qr', {
          body: { order_id: order.id, amount: amountToPay, customer_name: order.customer.name }
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000))
      ]);
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed to generate QR code');
      setQRData({
        qr_id: data.qr_code_id,
        image_url: data.qr_code_url,
        qr_string: data.qr_string,
        amount: data.amount || amountToPay,
        expires_at: data.expires_at
      });
      setShowQRDialog(true);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to generate payment QR' });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const completeDelivery = async (paymentMethod: 'COD' | 'ONLINE') => {
    if (!order) return;
    setIsCompleting(true);
    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke('unified-complete-delivery', {
          body: { order_id: order.id, payment_method: paymentMethod, order_type: orderType },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000))
      ]);

      if (error || !data?.success) throw new Error(data?.error || 'Failed to complete delivery');

      // ✅ Clear cache instead of invalidating — no refetch needed, orders screen reloads fresh
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: ['assigned-orders'] });

      const tipMsg = data.tip_amount && data.tip_amount > 0 ? ` + ₹${data.tip_amount} tip 💰` : '';
      toast({
        title: 'Delivery Completed!',
        description: data.already_completed
          ? 'This order was already marked as delivered.'
          : paymentMethod === 'COD' ? `Product delivered successfully - COD ✓${tipMsg}` : `Product delivered successfully - Paid Online ✓${tipMsg}`,
      });

      // ✅ Instant navigation — no setTimeout delay
      navigate('/my-deliveries', { replace: true });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to complete delivery' });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleQRPaymentComplete = async () => {
    setShowQRDialog(false);
    setIsCompleting(true);
    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke('unified-complete-delivery', {
          body: {
            order_id: order?.id,
            payment_method: 'ONLINE',
            qr_code_data: qrData?.qr_string,
            payment_id: qrData?.qr_id,
            order_type: orderType,
          },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 15000))
      ]);

      if (error || !data?.success) throw new Error(data?.error || 'Payment completed but delivery marking failed');

      // ✅ Clear cache + instant navigation
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: ['assigned-orders'] });

      toast({
        title: 'Delivery Completed!',
        description: data.already_completed ? 'This order was already marked as delivered.' : 'Product delivered successfully - Paid Online ✓',
      });

      navigate('/my-deliveries', { replace: true });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Payment received but failed to mark delivered. Please retry or contact support.',
        action: (
          <Button variant="outline" size="sm" onClick={() => handleQRPaymentComplete()}>
            Retry
          </Button>
        ),
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!order || !profile?.user_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'User profile not found' });
      return;
    }
    const confirmed = window.confirm('Are you sure you want to cancel this delivery? It will be released back to other agents.');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.functions.invoke('cancel-delivery', {
        body: { order_id: order.id, agent_id: profile.user_id, cancellation_reason: 'Agent cancelled from manage delivery page', order_type: orderType },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed to cancel delivery');

      toast({ title: 'Delivery Cancelled', description: 'Order has been cancelled successfully' });
      queryClient.removeQueries({ queryKey: ['orders'] });
      queryClient.removeQueries({ queryKey: ['assigned-orders'] });
      navigate(-1);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to cancel delivery' });
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
          <Button onClick={() => navigate(-1)}>Back to Home</Button>
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
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order Type</span>
                {(() => {
                  const hasSlot = !!(order.delivery_time_slot && typeof order.delivery_time_slot === 'string' && order.delivery_time_slot.includes('-'));
                  if (order.subscription_id) {
                    return <Badge variant="secondary" className="rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Subscription</Badge>;
                  }
                  if (hasSlot && order.payment_status === 'pending') {
                    return <Badge className="rounded-lg bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300">Book Now Get Later</Badge>;
                  }
                  if (hasSlot) {
                    return <Badge className="rounded-lg bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">Scheduled</Badge>;
                  }
                  return <Badge variant="secondary" className="rounded-lg">Regular</Badge>;
                })()}
              </div>
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
                <p className="text-sm mb-2">{displayAddress || 'Not available'}</p>
                {displayAddress && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openGoogleMapsAddress(displayAddress)}
                    className="gap-2 rounded-xl w-full mt-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Delivery Address
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
                    Pick Up Address
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
              <div className="pt-3 border-t-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold">Total Amount</span>
                  <span className="font-bold text-lg text-primary">
                    ₹{effectiveTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Schedule (for scheduled/BNGL orders with time slot) */}
          {order.delivery_time_slot && typeof order.delivery_time_slot === 'string' && order.delivery_time_slot.includes('-') && (
            <Card className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Delivery Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Slot</span>
                  <span className="font-medium">{order.delivery_time_slot}</span>
                </div>
                {order.delivery_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="font-medium">{order.delivery_date}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Special Instructions (filter out auto-generated schedule text) */}
          {(() => {
            const raw = order.special_instructions;
            if (!raw) return null;
            const filtered = raw.replace(/^Scheduled delivery for\s+\S+(\s+at\s+\S+)?\s*/i, '').trim();
            if (!filtered) return null;
            return (
              <Card className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Special Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{filtered}</p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Action Buttons */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t-2 space-y-3">
            {!isTerminalState && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-12 text-sm font-medium"
                  onClick={() => {
                    const coords = order.customer.coordinates;
                    if (coords?.lat && coords?.lng) {
                      openGoogleMapsCoordinates(coords.lat, coords.lng);
                    } else if (displayAddress) {
                      openGoogleMapsAddress(displayAddress);
                    } else {
                      toast({ variant: 'destructive', title: 'Error', description: 'Delivery address not available' });
                    }
                  }}
                >
                  <Navigation className="h-5 w-5 mr-2" />
                  Customer
                </Button>

                <Button
                  className="flex-1 rounded-xl h-12 text-sm font-medium"
                  onClick={handleMarkAsDelivered}
                  disabled={isCompleting || isGeneratingQR}
                >
                  {isCompleting ? (
                    <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Completing...</>
                  ) : isGeneratingQR ? (
                    <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Generating...</>
                  ) : (
                    <><CheckCircle className="h-5 w-5 mr-2" />Delivered</>
                  )}
                </Button>
              </div>
            )}

            {!isTerminalState && (
              <Button
                variant="destructive"
                className="w-full rounded-xl h-12 text-sm font-medium"
                onClick={handleCancel}
              >
                <XCircle className="h-5 w-5 mr-2" />
                Cancel Delivery
              </Button>
            )}

            {isTerminalState && (
              <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">
                  {order.status === 'delivered' ? 'Order Already Delivered' : 'Order Closed'}
                </span>
              </div>
            )}
          </div>
        </div>

        <PaymentMethodDialog
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onSelectMethod={handlePaymentMethodSelect}
          amount={effectiveTotal}
        />

        <RazorpayQRDisplay
          open={showQRDialog}
          onClose={() => setShowQRDialog(false)}
          qrData={qrData}
          orderAmount={qrData?.amount ?? effectiveTotal}
          onPaymentComplete={handleQRPaymentComplete}
        />
      </AppShell>
    </motion.div>
  );
}
