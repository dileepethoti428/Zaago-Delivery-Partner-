import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/StatusPill';
import { toast } from '@/hooks/use-toast';
import { getOrderDetails, type OrderDetails } from '@/services/orderDetails';
import { openGoogleMapsAddress, openGoogleMapsCoordinates } from '@/utils/maps';
import { useAuthStore } from '@/store/auth';
import { useResumeGuard } from '@/hooks/useResumeGuard';
import { safeRefreshSession } from '@/utils/appLifecycle';
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

/** Promise.race timeout wrapper for edge function calls */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s. Please retry.`)), ms)
    ),
  ]);
}

const EDGE_FN_TIMEOUT_MS = 15000;

export default function ManageDelivery() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrData, setQRData] = useState<any>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const orderType = searchParams.get('type') === 'daily' ? 'daily' : 'order';

  // Shared order fetch — used on mount and resume
  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getOrderDetails(id, { type: orderType });
      if (data) setOrder(data);
    } catch (e) {
      console.warn('[ManageDelivery] loadOrder failed:', e);
    }
  }, [id, orderType]);

  // Resume guard: reset loaders, refresh session, refetch order
  useResumeGuard(() => {
    console.log('[ManageDelivery] Resume detected — recovering');
    // 1. Reset all local loading flags
    setLoading(false);
    setIsCompleting(false);
    setIsGeneratingQR(false);
    setIsResuming(true);

    // 2. Background recovery (non-blocking)
    (async () => {
      try {
        await safeRefreshSession();
        await loadOrder();
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['available-orders'] });
        queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
        queryClient.invalidateQueries({ queryKey: ['orderDetails'] });
      } finally {
        setIsResuming(false);
      }
    })();
  });

  // Memoized calculations
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
    const terminalStatuses = ['delivered', 'cancelled', 'canceled', 'completed'];
    return terminalStatuses.includes(order.status?.toLowerCase());
  }, [order?.status]);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async (retryCount = 0) => {
      try {
        setLoading(true);
        const data = await getOrderDetails(id, { type: orderType });
        
        if (data) {
          setOrder(data);
        } else if (retryCount < 2) {
          console.log(`Order not found, retrying (${retryCount + 1}/2)...`);
          await new Promise(r => setTimeout(r, 800));
          return fetchOrder(retryCount + 1);
        } else {
          setOrder(null);
        }
      } catch (error: any) {
        console.error('Failed to load order:', error);
        if (retryCount < 2) {
          console.log(`Fetch error, retrying (${retryCount + 1}/2)...`);
          await new Promise(r => setTimeout(r, 800));
          return fetchOrder(retryCount + 1);
        }
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message || 'Failed to load order details',
        });
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, orderType]);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  /**
   * Preflight: refresh session + get fresh token before any edge function call.
   * Returns the access token or throws.
   */
  const preflightAuth = async (): Promise<string> => {
    await safeRefreshSession();
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Session expired. Please login again.');
    }
    return session.access_token;
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Invalid order amount. Cannot generate QR code.',
      });
      return;
    }

    setIsGeneratingQR(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Preflight session refresh
      await safeRefreshSession();
      
      console.log('Generating QR for amount:', amountToPay);
      
      const { data, error } = await withTimeout(
        supabase.functions.invoke('generate-payment-qr', {
          body: {
            order_id: order.id,
            amount: amountToPay,
            customer_name: order.customer.name
          }
        }),
        EDGE_FN_TIMEOUT_MS,
        'Generate QR'
      );

      if (error || !data?.success) {
        console.error('QR Generation Error:', { error, data, amountToPay });
        throw new Error(data?.error || error?.message || 'Failed to generate QR code');
      }

      const transformedData = {
        qr_id: data.qr_code_id,
        image_url: data.qr_code_url,
        qr_string: data.qr_string,
        amount: data.amount || amountToPay,
        expires_at: data.expires_at
      };

      setQRData(transformedData);
      setShowQRDialog(true);
    } catch (error: any) {
      console.error('Failed to generate QR:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to generate payment QR',
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const completeDelivery = async (paymentMethod: 'COD' | 'ONLINE') => {
    if (!order) return;

    setIsCompleting(true);
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Preflight: ensure session is valid before calling edge function
      const accessToken = await preflightAuth();

      const { data, error } = await withTimeout(
        supabase.functions.invoke('unified-complete-delivery', {
          body: {
            order_id: order.id,
            payment_method: paymentMethod,
            order_type: orderType,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }),
        EDGE_FN_TIMEOUT_MS,
        'Complete delivery'
      );

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to complete delivery');
      }

      if (data.already_completed) {
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        await queryClient.invalidateQueries({ queryKey: ['available-orders'] });
        await queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
        
        toast({
          title: 'Already Delivered',
          description: 'This order was already marked as delivered.',
        });
        
        navigate('/my-deliveries');
        return;
      } else {
        const successMessage = paymentMethod === 'COD' 
          ? 'Product delivered successfully - COD ✓'
          : 'Product delivered successfully - Paid Online ✓';
        
        toast({
          title: 'Delivery Completed!',
          description: successMessage,
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      
      setTimeout(() => navigate(-1), 1500);
      
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to complete delivery. Please retry.',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleQRPaymentComplete = async () => {
    setShowQRDialog(false);
    
    try {
      setIsCompleting(true);
      
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Preflight: ensure session is valid
      const accessToken = await preflightAuth();

      const { data, error } = await withTimeout(
        supabase.functions.invoke('unified-complete-delivery', {
          body: {
            order_id: order?.id,
            payment_method: 'ONLINE',
            qr_code_data: qrData?.qr_string,
            payment_id: qrData?.qr_id,
            order_type: orderType,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }),
        EDGE_FN_TIMEOUT_MS,
        'Complete delivery (QR)'
      );

      if (error || !data?.success) {
        throw new Error(data?.error || 'Payment completed but delivery marking failed');
      }

      if (data.already_completed) {
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
        await queryClient.invalidateQueries({ queryKey: ['available-orders'] });
        await queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
        
        toast({
          title: 'Already Delivered',
          description: 'This order was already marked as delivered.',
        });
        
        navigate('/my-deliveries');
        return;
      } else {
        toast({
          title: 'Delivery Completed!',
          description: 'Product delivered successfully - Paid Online ✓',
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      
      setTimeout(() => navigate(-1), 1500);
      
    } catch (error: any) {
      console.error('Delivery completion failed:', {
        order_id: order?.id,
        payment_method: 'ONLINE',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      toast({
        variant: 'destructive',
        title: 'Payment Completed, Delivery Failed',
        description: error.message || 'Payment received but failed to mark delivered. Please retry or contact support.',
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User profile not found',
      });
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel this delivery? It will be released back to other partners.'
    );
    
    if (!confirmed) return;

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('cancel-delivery', {
        body: {
          order_id: order.id,
          agent_id: profile.user_id,
          cancellation_reason: 'Agent cancelled from manage delivery page',
          order_type: orderType
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to cancel delivery');
      }

      toast({
        title: 'Delivery Cancelled',
        description: 'Order has been cancelled successfully',
      });
      
      navigate(-1);
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
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
                      toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: 'Delivery address not available',
                      });
                    }
                  }}
                >
                  <Navigation className="h-5 w-5 mr-2" />
                  Customer
                </Button>

                <Button
                  className="flex-1 rounded-xl h-12 text-sm font-medium"
                  onClick={handleMarkAsDelivered}
                  disabled={isCompleting || isGeneratingQR || isResuming}
                >
                  {isResuming ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Reconnecting...
                    </>
                  ) : isCompleting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Completing...
                    </>
                  ) : isGeneratingQR ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Delivered
                    </>
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
