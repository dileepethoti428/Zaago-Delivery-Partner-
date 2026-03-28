import { memo, useCallback } from 'react';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScheduledBadge } from '@/components/order/ScheduledBadge';

import { Clock, IndianRupee } from 'lucide-react';
import type { ZaagoOrder } from '@/services/orders';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: ZaagoOrder & { distanceKm?: number };
  index: number;
  isProcessing: boolean;
  currentAgentId?: string;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onView: (orderId: string) => void;
  onManage?: (orderId: string) => void;
}

export const OrderCard = memo(function OrderCard({
  order,
  index,
  isProcessing,
  currentAgentId,
  onAccept,
  onReject,
  onView,
  onManage,
}: OrderCardProps) {
  const handleAccept = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAccept(order.id);
  }, [order.id, onAccept]);
  
  const handleReject = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onReject(order.id);
  }, [order.id, onReject]);
  
  const handleView = useCallback(() => {
    onView(order.id);
  }, [order.id, onView]);

  const handleManage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onManage) {
      onManage(order.id);
    }
  }, [order.id, onManage]);

  const isAssignedToCurrentAgent = order.agentId === currentAgentId;
  const isAssignedToOtherAgent = !!(order.agentId && order.agentId !== currentAgentId);
  const isScheduled = order.deliveryType === 'scheduled';
  const isSubscription = order.deliveryType === 'subscription';
  const isBookNowGetLater = order.deliveryType === 'book_now_pay_later';

  // Determine button state: 
  // 1. Assigned to me → Manage Delivery
  // 2. Unassigned → Accept / Reject
  // 3. Assigned to someone else → Disabled "Taken" button
  const renderActionButtons = () => {
    if (isAssignedToCurrentAgent) {
      return (
        <Button
          size="sm"
          className="flex-1"
          onClick={handleManage}
        >
          Manage Delivery
        </Button>
      );
    }
    
    if (isAssignedToOtherAgent) {
      return (
        <Button
          size="sm"
          className="flex-1"
          variant="secondary"
          disabled
        >
          Taken
        </Button>
      );
    }
    
    // Unassigned - show Accept/Reject
    return (
      <>
        <Button
          size="sm"
          className="flex-1"
          disabled={isProcessing}
          onClick={handleAccept}
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isProcessing}
          onClick={handleReject}
        >
          Reject
        </Button>
      </>
    );
  };

  return (
    <AnimatedCard delay={index * 0.05} onClick={handleView}>
      <CardContent 
        className={cn(
          "p-4",
          isScheduled && "border-l-4 border-l-blue-500",
          isSubscription && "border-l-4 border-l-purple-500",
          isBookNowGetLater && "border-l-4 border-l-amber-500"
        )}
      >
        <div className="space-y-3">
          {/* Type banner strip for instant recognition */}
          {isBookNowGetLater && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 -mx-1 border border-amber-200">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Book Now Get Later</span>
              {order.deliveryTimeSlot && (
                <span className="ml-auto text-xs font-medium text-amber-600">{order.deliveryTimeSlot}</span>
              )}
            </div>
          )}
          {isSubscription && (
            <div className="flex items-center gap-2 rounded-md bg-purple-50 px-3 py-1.5 -mx-1 border border-purple-200">
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Subscription</span>
            </div>
          )}
          {isScheduled && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 -mx-1 border border-blue-200">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Scheduled</span>
              {order.deliveryTimeSlot && (
                <span className="ml-auto text-xs font-medium text-blue-600">{order.deliveryTimeSlot}</span>
              )}
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="font-semibold text-base text-foreground">
                  {order.customerName || 'Unknown Customer'}
                </span>
                <StatusPill status={order.status} />
                {!isBookNowGetLater && !isSubscription && !isScheduled && (
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase">Regular</span>
                )}
              </div>

              {/* Scheduled order time slot */}
              {isScheduled && order.deliveryTimeSlot && (
                <div className="mb-3">
                  <ScheduledBadge 
                    timeSlot={order.deliveryTimeSlot} 
                    date={order.deliveryDate} 
                  />
                </div>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Pickup</p>
                    <p className="text-muted-foreground">{order.pickup}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Drop</p>
                    <p className="text-muted-foreground">{order.drop}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {order.distanceKm !== undefined && (
              <DistanceBadge distance={order.distanceKm} />
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{order.etaMin || 'N/A'} min</span>
            </div>
            
            <div className="flex items-center gap-1 font-semibold text-green-600">
              <IndianRupee className="h-4 w-4" />
              <span>₹{order.payout}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {renderActionButtons()}
          </div>
        </div>
      </CardContent>
    </AnimatedCard>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.order.id === nextProps.order.id &&
    prevProps.order.status === nextProps.order.status &&
    prevProps.order.distanceKm === nextProps.order.distanceKm &&
    prevProps.order.agentId === nextProps.order.agentId &&
    prevProps.order.deliveryType === nextProps.order.deliveryType &&
    prevProps.order.deliveryTimeSlot === nextProps.order.deliveryTimeSlot &&
    prevProps.order.deliveryDate === nextProps.order.deliveryDate &&
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.currentAgentId === nextProps.currentAgentId &&
    prevProps.index === nextProps.index
  );
});
