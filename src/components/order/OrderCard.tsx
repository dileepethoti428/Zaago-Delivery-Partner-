import { memo, useCallback } from 'react';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Clock, IndianRupee, MapPin } from 'lucide-react';
import type { ZaagoOrder } from '@/services/orders';

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

  return (
    <AnimatedCard delay={index * 0.05} onClick={handleView}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground">
                  #{order.id.slice(0, 8)}
                </span>
                <StatusPill status={order.status} />
              </div>
              
              <div className="flex items-start gap-2 text-sm mb-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{order.pickup}</p>
                  <p className="text-muted-foreground">→ {order.drop}</p>
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
            {isAssignedToCurrentAgent ? (
              <Button
                size="sm"
                className="flex-1"
                onClick={handleManage}
              >
                Manage Delivery
              </Button>
            ) : (
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
            )}
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
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.currentAgentId === nextProps.currentAgentId &&
    prevProps.index === nextProps.index
  );
});
