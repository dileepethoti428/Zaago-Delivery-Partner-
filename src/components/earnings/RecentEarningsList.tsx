import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Receipt, Package, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatCurrency, EarningRecord } from '@/services/earnings';
import { formatDateTimeIST } from '@/utils/dateUtils';
import { motion } from 'framer-motion';

// Zepto/Blinkit pricing constants for validation
const REGULAR_ORDER_PRICING = {
  BASE_PAY: 10,
  DISTANCE_RATE: 8,
};

// Validate and fix payout if breakdown exists but total is wrong
function getValidatedPayout(earning: EarningRecord): { payout: number; isFixed: boolean } {
  const breakdown = earning.payout_breakdown;
  const actualPayout = earning.actual_payout ?? earning.expected_payout;
  
  // If we have a valid breakdown, calculate the correct total
  if (breakdown && typeof breakdown.base_pay === 'number' && typeof breakdown.distance_pay === 'number') {
    const calculatedTotal = breakdown.base_pay + breakdown.distance_pay;
    
    // If there's a mismatch greater than ₹0.50, use calculated value from breakdown
    if (Math.abs(calculatedTotal - actualPayout) > 0.5) {
      console.warn(`Payout mismatch for order ${earning.order_id}: DB has ₹${actualPayout}, calculated ₹${calculatedTotal}`);
      return { payout: calculatedTotal, isFixed: true };
    }
    return { payout: actualPayout, isFixed: false };
  }
  
  // If we have distance but no breakdown, calculate fresh using Zepto formula
  if (earning.distance_km && earning.distance_km > 0 && earning.order_type === 'regular') {
    const roundedDistance = Math.round(earning.distance_km * 10) / 10;
    const distancePay = roundedDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
    const calculatedTotal = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
    
    // Check if stored value differs significantly
    if (Math.abs(calculatedTotal - actualPayout) > 0.5) {
      console.warn(`Payout mismatch for order ${earning.order_id}: DB has ₹${actualPayout}, formula gives ₹${calculatedTotal}`);
      return { payout: calculatedTotal, isFixed: true };
    }
  }
  
  // Fallback to stored value
  return { payout: actualPayout, isFixed: false };
}

interface RecentEarningsListProps {
  earnings: EarningRecord[];
  type: 'all' | 'regular' | 'subscription';
  delay?: number;
}

export function RecentEarningsList({ earnings, type, delay = 0 }: RecentEarningsListProps) {
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
        return <Badge variant="default" className="bg-green-600 text-white text-xs">Delivered</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">Pending</Badge>;
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
        <CardContent className="space-y-3">
          {earnings.map((earning, index) => {
            // Validate payout for regular orders
            const { payout: validatedPayout, isFixed } = earning.order_type === 'regular' 
              ? getValidatedPayout(earning)
              : { payout: 0, isFixed: false };
            
            return (
              <div 
                key={earning.order_id} 
                className={`py-3 ${index < earnings.length - 1 ? 'border-b' : ''}`}
              >
                {/* Order Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {type === 'subscription' && earning.subscription_id 
                        ? `Sub #${earning.subscription_id.slice(0, 8)}...`
                        : `Order #${earning.order_id.slice(0, 8)}...`
                      }
                    </span>
                    {getStatusBadge(earning.status)}
                    {getTypeLabel(earning)}
                    {isFixed && (
                      <span title="Payout auto-corrected using formula">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      </span>
                    )}
                  </div>
                  {earning.status === 'pending' && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Expected
                    </div>
                  )}
                </div>

                {/* Zepto/Blinkit style breakdown for regular orders */}
                {type === 'regular' && earning.payout_breakdown && earning.order_type === 'regular' && (
                  <div className="mt-2 bg-muted/50 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base Pay</span>
                      <span className="font-medium">₹{earning.payout_breakdown.base_pay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Distance Pay ({earning.payout_breakdown.distance_km} km × ₹{earning.payout_breakdown.rate_per_km})
                      </span>
                      <span className="font-medium">₹{earning.payout_breakdown.distance_pay}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1.5 border-t border-border/50">
                      <span className="font-semibold">Total Payout</span>
                      <span className="font-bold text-primary">
                        {formatCurrency(validatedPayout)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Simple display for all tab - show payout only for regular orders */}
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
                    {/* Show payout only for regular orders, not subscription */}
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

                {/* Timestamp for regular orders with breakdown */}
                {type === 'regular' && earning.payout_breakdown && earning.order_type === 'regular' && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatDateTimeIST(earning.accepted_at)}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
