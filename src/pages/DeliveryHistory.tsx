import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, ChevronDown } from 'lucide-react';
import { useDeliveryHistory } from '@/hooks/useDeliveryHistory';
import { DeliveryHistoryCard } from '@/components/delivery/DeliveryHistoryCard';

export default function DeliveryHistory() {
  const { data, isLoading: loading } = useDeliveryHistory(50, 0, undefined, true);
  const history = data?.data || [];
  const [visibleCount, setVisibleCount] = useState(5);

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

  const visibleHistory = history.slice(0, visibleCount);
  const hasMore = history.length > visibleCount;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Delivery History</h1>
          <Badge variant="secondary">{history.length} deliveries</Badge>
        </div>

        <div className="space-y-4">
          {visibleHistory.map((delivery, index) => (
            <DeliveryHistoryCard
              key={delivery.id}
              delivery={delivery}
              index={index}
            />
          ))}
        </div>

        {hasMore && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setVisibleCount((prev) => prev + 5)}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            View More ({history.length - visibleCount} remaining)
          </Button>
        )}
      </div>
    </AppShell>
  );
}
