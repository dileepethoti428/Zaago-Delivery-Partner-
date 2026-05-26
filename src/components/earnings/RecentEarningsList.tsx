import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, Package, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, EarningRecord } from '@/services/earnings';
import { formatDateTimeIST } from '@/utils/dateUtils';
import { motion } from 'framer-motion';

// Derive the per-km rate from the server-provided breakdown.
// The rate is set in the DB function complete_delivery_zepto — never hardcode it here.
function getRatePerKm(breakdown: NonNullable<EarningRecord['payout_breakdown']>): number | null {
  if (typeof breakdown.rate_per_km === 'number' && breakdown.rate_per_km > 0) {
    return breakdown.rate_per_km;
  }
  if (breakdown.distance_km && breakdown.distance_km > 0 && typeof breakdown.distance_pay === 'number') {
    return Math.round((breakdown.distance_pay / breakdown.distance_km) * 10) / 10;
  }
  return null;
}

function getActualPayout(earning: EarningRecord): number {
  return earning.actual_payout ?? earning.expected_payout;
}

interface RecentEarningsListProps {
  earnings: EarningRecord[];
  type: 'all' | 'regular' | 'subscription';
  delay?: number;
}

const PAGE_SIZE = 5;

export function RecentEarningsList({ earnings, type, delay = 0 }: RecentEarningsListProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!earnings || earnings.length === 0) {
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
              Recent {type === 'subscription' ? 'Subscription' : type === 'regular' ? 'Regular' : ''} Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent deliveries</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'pending':
        return <Badge variant="default" className="bg-green-600 text-white text-xs">Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getTypeLabel = (record: EarningRecord) => {
    if (type === 'all') {
      return record.order_type === 'subscription'
        ? <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">Subscription</Badge>
        : <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">Regular</Badge>;
    }
    return null;
  };

  const visibleEarnings = earnings.slice(0, visibleCount);
  const hasMore = visibleCount < earnings.length;
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
            Recent {type === 'subscription' ? 'Subscription' : type === 'regular' ? 'Regular Order' : ''} Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto px-6 py-4 space-y-3">
            {visibleEarnings.map((earning, index) => {
              const validatedPayout = earning.order_type === 'regular' ? getActualPayout(earning) : 0;
              const ratePerKm = earning.payout_breakdown ? getRatePerKm(earning.payout_breakdown) : null;

              return (
                <div
                  key={earning.order_id || earning.daily_order_id || `earning-${index}`}
                  className={`py-3 ${index < visibleEarnings.length - 1 ? 'border-b' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {earning.order_type === 'subscription' || earning.daily_order_id
                          ? earning.daily_order_id
                            ? `Sub #${earning.daily_order_id.slice(0, 8)}...`
                            : `Delivery #${index + 1}`
                          : earning.order_id
                            ? `Order #${earning.order_id.slice(0, 8)}...`
                            : `Delivery #${index + 1}`
                        }
                      </span>
                      {getStatusBadge(earning.status)}
                      {getTypeLabel(earning)}
                    </div>
                    {earning.status === 'pending' && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Payout pending
                      </div>
                    )}
                  </div>

                  {type === 'regular' && earning.payout_breakdown && earning.order_type === 'regular' &&
                   (earning.payout_breakdown.base_pay > 0 || earning.payout_breakdown.distance_pay > 0) && (
                    <div className="mt-2 bg-muted/50 rounded-lg p-3 space-y-1.5">
                      {earning.payout_breakdown.base_pay > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Base Pay</span>
                          <span className="font-medium">₹{earning.payout_breakdown.base_pay}</span>
                        </div>
                      )}
                      {earning.payout_breakdown.distance_pay > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Distance Pay ({earning.payout_breakdown.distance_km} km{ratePerKm !== null ? ` × ₹${ratePerKm}/km` : ''})
                          </span>
                          <span className="font-medium">₹{earning.payout_breakdown.distance_pay}</span>
                        </div>
                      )}
                      {earning.tip_amount && earning.tip_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">💰 Customer Tip</span>
                          <span className="font-medium text-green-600">₹{earning.tip_amount}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm pt-1.5 border-t border-border/50">
                        <span className="font-semibold">Total Payout</span>
                        <span className="font-bold text-primary">
                          {formatCurrency(validatedPayout)}
                        </span>
                      </div>
                    </div>
                  )}


                  {(type !== 'regular' || earning.order_type !== 'regular') && (
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTimeIST(earning.accepted_at)}</span>
                        {earning.distance_km > 0 && (
                          <>
                            <span>•</span>
                            <span>{earning.distance_km.toFixed(1)} km</span>
                          </>
                        )}
                      </div>
                      {earning.order_type === 'regular' ? (
                        <div className="font-semibold text-primary">
                          {formatCurrency(validatedPayout)}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">
                          Delivered
                        </Badge>
                      )}
                    </div>
                  )}

                  {type === 'regular' && earning.payout_breakdown && earning.order_type === 'regular' && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatDateTimeIST(earning.accepted_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {earnings.length > PAGE_SIZE && (
            <div className="px-6 pb-4 pt-2 flex justify-center border-t">
              {hasMore ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, earnings.length))}
                >
                  View More ({earnings.length - visibleCount} more)
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
