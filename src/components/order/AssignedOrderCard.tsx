import { memo, useCallback } from 'react';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Clock, MapPin, Phone, Package, Calendar, RefreshCw, Palmtree } from 'lucide-react';
import type { AssignedOrder } from '@/services/assignedOrders';

// Helper to safely extract address string from string or object
const getAddressString = (address: unknown): string => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    const addr = address as Record<string, unknown>;
    if (addr.full_address && typeof addr.full_address === 'string') {
      return addr.full_address;
    }
    // Fallback: combine available fields
    const parts = [addr.address, addr.street, addr.area, addr.city]
      .filter(p => p && typeof p === 'string');
    return parts.join(', ') || '';
  }
  return '';
};

interface AssignedOrderCardProps {
  order: AssignedOrder;
  index: number;
  dateLabel?: string;
  onManage: () => void;
}

export const AssignedOrderCard = memo(function AssignedOrderCard({
  order,
  index,
  dateLabel,
  onManage,
}: AssignedOrderCardProps) {
  const handleManage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onManage();
  }, [onManage]);

  return (
    <AnimatedCard delay={index * 0.05} onClick={onManage}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with badges */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-semibold text-base text-foreground">
                  {order.customerName}
                </span>
                {order.isSubscription && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Subscription
                  </Badge>
                )}
              </div>
              
              {/* Product info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Package className="h-4 w-4" />
                <span>{order.productName}</span>
                <span className="text-foreground font-medium">× {order.quantity}</span>
              </div>
            </div>

            {/* Date badge (shown in "All" view) */}
            {dateLabel && (
              <Badge variant="outline" className="shrink-0">
                <Calendar className="h-3 w-3 mr-1" />
                {dateLabel}
              </Badge>
            )}
          </div>

          {/* Delivery address */}
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-muted-foreground">
                {getAddressString(order.deliveryAddress) || getAddressString(order.customerAddress) || 'No address'}
              </p>
              {order.customerCity && (
                <p className="text-xs text-muted-foreground">
                  {order.customerCity}{order.customerPincode ? ` - ${order.customerPincode}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Time slot & phone */}
          <div className="flex items-center justify-between text-sm">
            {order.deliveryTimeSlot && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{order.deliveryTimeSlot}</span>
              </div>
            )}
            
            {order.customerPhone && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{order.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Action button */}
          <div className="pt-2">
            <Button
              size="sm"
              className="w-full"
              onClick={handleManage}
            >
              Manage Delivery
            </Button>
          </div>
        </div>
      </CardContent>
    </AnimatedCard>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.order.id === nextProps.order.id &&
    prevProps.order.status === nextProps.order.status &&
    prevProps.order.quantity === nextProps.order.quantity &&
    prevProps.dateLabel === nextProps.dateLabel &&
    prevProps.index === nextProps.index
  );
});
