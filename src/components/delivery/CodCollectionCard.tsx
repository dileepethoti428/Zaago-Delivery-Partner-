import { useCodBalance } from '@/hooks/useCodBalance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, Store, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function CodCollectionCard() {
  const { data, isLoading, error } = useCodBalance();

  // Don't render if no pending COD
  if (!isLoading && (!data || data.total_pending === 0)) return null;

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  if (error) return null; // Fail silently

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          COD Cash to Submit
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {/* Total */}
        <div className="flex items-center gap-1 mb-3">
          <IndianRupee className="h-5 w-5 text-destructive" />
          <span className="text-2xl font-bold text-destructive">
            {data!.total_pending.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Per-seller breakdown */}
        <div className="space-y-2">
          {data!.seller_breakdown.map((seller) => (
            <div
              key={seller.seller_id}
              className="flex items-center justify-between text-sm bg-background/60 rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-2 text-foreground">
                <Store className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate max-w-[140px]">{seller.seller_name}</span>
                <span className="text-muted-foreground text-xs">
                  ({seller.order_count} {seller.order_count === 1 ? 'order' : 'orders'})
                </span>
              </div>
              <span className="font-semibold text-destructive whitespace-nowrap">
                ₹{seller.pending_amount.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
