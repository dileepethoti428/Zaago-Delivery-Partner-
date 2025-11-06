import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/StatusPill';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { useOrdersStore } from '@/store/orders';
import { useAuthStore } from '@/store/auth';
import { openGoogleMapsAddress } from '@/utils/maps';
import { updateOrderStatus as updateOrderStatusService } from '@/services/updateOrderStatus';
import { toast } from '@/hooks/use-toast';
import { MapPin, Clock, IndianRupee, ExternalLink, ArrowLeft, CheckCircle, XCircle, Package } from 'lucide-react';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import type { ZaagoOrder } from '@/services/orders';

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, getOrderById, updateOrderStatus, acceptOrder: storeAcceptOrder } = useOrdersStore();
  const { user } = useAuthStore();
  const order = getOrderById(id || '');

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

  const handleStatusUpdate = async (newStatus: ZaagoOrder['status'], successMessage: string) => {
    if (!order) return;
    
    // Take snapshot for rollback
    const prevOrders = [...orders];
    
    try {
      // Optimistic update
      updateOrderStatus(order.id, newStatus);
      
      // Call Supabase
      await updateOrderStatusService(order.id, newStatus);
      
      toast({
        title: 'Success',
        description: successMessage,
      });
    } catch (err: any) {
      // Rollback on error
      orders.forEach((o, idx) => {
        if (prevOrders[idx]) {
          updateOrderStatus(o.id, prevOrders[idx].status);
        }
      });
      
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to update order status.',
      });
    }
  };

  const handleAccept = async () => {
    if (!order) return;
    if (order.status !== 'new' && order.status !== 'open' && order.status !== 'packed') return;
    
    // Validate order_id
    if (!order.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Order ID missing',
      });
      return;
    }

    // Validate agent_id
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User not authenticated',
      });
      return;
    }

    try {
      await storeAcceptOrder(order.id, user.id);
    } catch (error: any) {
      // Error handling is done in the store
      console.error('Accept order failed:', error);
    }
  };

  const handlePickedUp = () => {
    if (order?.status !== 'accepted') return;
    handleStatusUpdate('picked_up', `Order ${order.id} marked as picked up 📦`);
  };

  const handleDelivered = () => {
    if (order?.status !== 'picked_up') return;
    handleStatusUpdate('delivered', `Order ${order.id} delivered successfully ✅`);
  };

  const handleCancel = () => {
    if (order?.status === 'delivered' || order?.status === 'cancelled') return;
    handleStatusUpdate('cancelled', `Order ${order.id} has been cancelled`);
  };

  const getTimelineStatus = (step: string) => {
    if (!order) return 'pending';
    
    const statusMap: Record<string, number> = {
      'Created': 0,
      'Accepted': 1,
      'Picked Up': 2,
      'Delivered': 3,
    };

    const currentStatusIndex: Record<string, number> = {
      'new': 0,
      'open': 0,
      'accepted': 1,
      'picked': 2,
      'picked_up': 2,
      'delivered': 3,
      'canceled': 0,
      'cancelled': 0,
    };

    const stepIndex = statusMap[step];
    const orderIndex = currentStatusIndex[order.status] ?? 0;

    if ((order.status === 'canceled' || order.status === 'cancelled') && step === 'Created') {
      return 'canceled';
    }
    if (stepIndex <= orderIndex) {
      return 'completed';
    }
    if (stepIndex === orderIndex + 1) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <motion.div initial={pageTransition.initial} animate={pageTransition.animate} exit={pageTransition.exit} transition={pageTransitionConfig} className="h-full">
      <AppShell showTabBar={false}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          className="space-y-6 py-4"
        >
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
            <h1 className="text-2xl font-bold">{order.id}</h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusPill status={order.status} />
              {order.distanceKm && <DistanceBadge distance={order.distanceKm} />}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="rounded-2xl border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  Pickup Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{order.pickup}</p>
                <Button
                  variant="outline"
                  className="w-full gap-2 rounded-xl"
                  onClick={() => openGoogleMapsAddress(order.pickup)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Google Maps
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="rounded-2xl border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{order.drop}</p>
                <Button
                  variant="outline"
                  className="w-full gap-2 rounded-xl"
                  onClick={() => openGoogleMapsAddress(order.drop)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in Google Maps
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Estimated Time
                </div>
                <span className="font-medium">{order.etaMin} minutes</span>
              </div>
              
              {order.distanceKm && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    Distance
                  </div>
                  <span className="font-medium">{order.distanceKm} km</span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IndianRupee className="h-4 w-4" />
                  Payout
                </div>
                <span className="font-bold text-lg text-green-600">₹{order.payout}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['Created', 'Accepted', 'Picked Up', 'Delivered'].map((step, index) => {
                  const status = getTimelineStatus(step);
                  return (
                    <div key={step} className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                        status === 'completed' 
                          ? 'bg-primary text-primary-foreground' 
                          : status === 'active'
                          ? 'bg-primary/20 text-primary border-2 border-primary'
                          : status === 'canceled'
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {status === 'completed' || status === 'canceled' ? (
                          status === 'canceled' ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )
                        ) : (
                          <div className={`h-2 w-2 rounded-full ${
                            status === 'active' ? 'bg-primary' : 'bg-muted-foreground'
                          }`} />
                        )}
                      </div>
                      <span className={
                        status === 'completed' || status === 'active'
                          ? 'font-medium' 
                          : status === 'canceled'
                          ? 'text-destructive font-medium'
                          : 'text-muted-foreground'
                      }>
                        {step}
                        {status === 'canceled' && step === 'Created' && ' (Canceled)'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid gap-3 sticky bottom-20 pb-4"
        >
          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              className="w-full rounded-xl h-12 text-base font-medium"
              onClick={handleAccept}
              disabled={order.status !== 'new' && order.status !== 'open'}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Accept Order
            </Button>
          </motion.div>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              className="w-full rounded-xl h-12 text-base font-medium"
              onClick={handlePickedUp}
              disabled={order.status !== 'accepted'}
            >
              <Package className="h-5 w-5 mr-2" />
              Mark as Picked Up
            </Button>
          </motion.div>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              className="w-full rounded-xl h-12 text-base font-medium"
              onClick={handleDelivered}
              disabled={order.status !== 'picked_up'}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Mark as Delivered
            </Button>
          </motion.div>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              variant="destructive"
              className="w-full rounded-xl h-12 text-base font-medium"
              onClick={handleCancel}
              disabled={order.status === 'delivered' || order.status === 'cancelled'}
            >
              <XCircle className="h-5 w-5 mr-2" />
              Cancel Order
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AppShell>
    </motion.div>
  );
}
