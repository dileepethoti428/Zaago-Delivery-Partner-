import { memo, useCallback } from 'react';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { Clock, MapPin, Phone, Package, Calendar, RefreshCw, Palmtree, Navigation } from 'lucide-react';
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
    const parts = [addr.address, addr.street, addr.area, addr.city]
      .filter(p => p && typeof p === 'string');
    return parts.join(', ') || '';
  }
  return '';
};

// Border accent class based on delivery type
const getBorderClass = (type: AssignedOrder['deliveryType']): string => {
  switch (type) {
    case 'scheduled': return 'border-l-4 border-l-blue-500';
    case 'subscription': return 'border-l-4 border-l-purple-500';
    case 'book_now_pay_later': return 'border-l-4 border-l-amber-500';
    default: return '';
  }
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

  const handleNavigate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const lat = order.deliveryLatitude ?? order.customerLatitude;
    const lng = order.deliveryLongitude ?? order.customerLongitude;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  }, [order]);

  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)} km`;
  };

  return (
    <AnimatedCard delay={index * 0.05} onClick={order.isOnVacation ? undefined : onManage} className={getBorderClass(order.deliveryType)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with badges */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-semibold text-base text-foreground">
                  {order.customerName}
                </span>
                {order.deliveryType === 'subscription' && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Subscription
                  </Badge>
                )}
                {order.deliveryType === 'scheduled' && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Scheduled
                  </Badge>
                )}
                {order.deliveryType === 'book_now_pay_later' && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 text-xs">
                    <Package className="h-3 w-3 mr-1" />
                    Book Now Get Later
                  </Badge>
                )}
                {order.isCompensation && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Compensation
                  </Badge>
                )}
                {order.isOnVacation && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 text-xs">
                    <Palmtree className="h-3 w-3 mr-1" />
                    On Vacation
                  </Badge>
                )}
                {order.distanceFromShop != null && (
                  <Badge variant="secondary" className="gap-1 text-xs font-medium">
                    <MapPin className="h-3 w-3" />
                    {formatDistance(order.distanceFromShop)}
                  </Badge>
                )}
              </div>
              
              {/* Product info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Package className="h-4 w-4" />
                <span>
                  {order.productName}
                  {order.productUnit && <span className="ml-1">· {order.productUnit}</span>}
                </span>
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
            {order.isOnVacation ? (
              <Button
                size="sm"
                className="w-full bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-not-allowed dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700"
                disabled
              >
                <Palmtree className="h-4 w-4 mr-2" />
                Skip — Customer On Vacation
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full"
                onClick={handleManage}
              >
                Manage Delivery
              </Button>
            )}
            {!order.isOnVacation && (order.deliveryLatitude || order.customerLatitude) && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={handleNavigate}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Navigate
              </Button>
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
    prevProps.order.quantity === nextProps.order.quantity &&
    prevProps.order.isOnVacation === nextProps.order.isOnVacation &&
    prevProps.order.distanceFromShop === nextProps.order.distanceFromShop &&
    prevProps.order.deliveryType === nextProps.order.deliveryType &&
    prevProps.dateLabel === nextProps.dateLabel &&
    prevProps.index === nextProps.index
  );
});
