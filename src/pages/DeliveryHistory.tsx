import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { Package, MapPin, Clock, Star, IndianRupee } from 'lucide-react';
import { fetchDeliveryHistory, formatDeliveryDate, formatDeliveryTime, type DeliveryHistoryItem } from '@/services/deliveryHistory';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CardContent } from '@/components/ui/card';

export default function DeliveryHistory() {
  const [history, setHistory] = useState<DeliveryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await fetchDeliveryHistory(50, 0);
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to load delivery history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (history.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Delivery History</h2>
          <p className="text-muted-foreground">
            Your completed deliveries will appear here
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Delivery History</h1>
          <Badge variant="secondary">{history.length} deliveries</Badge>
        </div>

        <div className="space-y-4">
          {history.map((delivery, index) => (
            <AnimatedCard
              key={delivery.id}
              delay={index * 0.05}
              onClick={() => navigate(`/order/${delivery.order_id}`)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm text-muted-foreground">
                          #{delivery.order_id.slice(0, 8)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg">
                        {delivery.customer_name || 'Customer'}
                      </h3>
                    </div>
                    <StatusPill status={delivery.payment_status === 'paid' ? 'completed' : 'pending'} />
                  </div>

                  {/* Delivery Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDeliveryDate(delivery.completed_at)}</span>
                    </div>
                    <span>•</span>
                    <span>{formatDeliveryTime(delivery.completed_at)}</span>
                  </div>

                  {/* Address */}
                  {delivery.delivery_address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground line-clamp-2">
                        {typeof delivery.delivery_address === 'string' 
                          ? delivery.delivery_address 
                          : delivery.delivery_address?.address || 'Delivery address'}
                      </span>
                    </div>
                  )}

                  {/* Bottom Row */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-3">
                      {delivery.distance_traveled && (
                        <DistanceBadge distance={delivery.distance_traveled} />
                      )}
                      {delivery.customer_rating && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{delivery.customer_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-semibold text-lg text-primary">
                      <IndianRupee className="h-4 w-4" />
                      {delivery.delivery_payout?.toFixed(0) || '0'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </AnimatedCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
