import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, Package, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { EarningRecord } from '@/services/earnings';
import { formatDateTimeIST } from '@/utils/dateUtils';
import { motion } from 'framer-motion';

interface SubscriptionDeliveryListProps {
  deliveries: EarningRecord[];
  delay?: number;
}

const PAGE_SIZE = 5;

export function SubscriptionDeliveryList({ deliveries, delay = 0 }: SubscriptionDeliveryListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!deliveries || deliveries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, ease: [0.4, 0, 0.2, 1] }}
      >
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Recent Subscription Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent subscription deliveries</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-600 text-white text-xs">Delivered</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="text-xs">Skipped</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const visibleDeliveries = deliveries.slice(0, visibleCount);
  const hasMore = visibleCount < deliveries.length;
  const isExpanded = visibleCount > PAGE_SIZE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Recent Subscription Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto px-6 py-4 space-y-3">
            {visibleDeliveries.map((delivery, index) => (
              <div
                key={delivery.subscription_id || delivery.daily_order_id || `delivery-${index}`}
                className={`py-3 ${index < visibleDeliveries.length - 1 ? 'border-b' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RefreshCw className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">
                      {delivery.subscription_id
                        ? `Sub #${delivery.subscription_id.slice(0, 8)}...`
                        : delivery.daily_order_id
                          ? `Delivery #${delivery.daily_order_id.slice(0, 8)}...`
                          : `Delivery #${index + 1}`
                      }
                    </span>
                  </div>
                  {getStatusBadge(delivery.status)}
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{formatDateTimeIST(delivery.accepted_at)}</span>
                  {delivery.distance_km > 0 && (
                    <>
                      <span>•</span>
                      <span>{delivery.distance_km.toFixed(1)} km</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {deliveries.length > PAGE_SIZE && (
            <div className="px-6 pb-4 pt-2 flex justify-center border-t">
              {hasMore ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, deliveries.length))}
                >
                  View More ({deliveries.length - visibleCount} more)
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              ) : isExpanded ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                >
                  View Less
                  <ChevronUp className="ml-1 h-4 w-4" />
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
