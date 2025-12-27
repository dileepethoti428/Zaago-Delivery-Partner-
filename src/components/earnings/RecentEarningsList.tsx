import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Receipt, Package, RefreshCw } from 'lucide-react';
import { formatCurrency, EarningRecord } from '@/services/earnings';
import { formatDateTimeIST } from '@/utils/dateUtils';
import { motion } from 'framer-motion';

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
          {earnings.map((earning, index) => (
            <div 
              key={earning.order_id} 
              className={`flex items-center justify-between py-2 ${index < earnings.length - 1 ? 'border-b' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {type === 'subscription' && earning.subscription_id 
                      ? `Sub #${earning.subscription_id.slice(0, 8)}...`
                      : `Order #${earning.order_id.slice(0, 8)}...`
                    }
                  </span>
                  {getStatusBadge(earning.status)}
                  {getTypeLabel(earning)}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{formatDateTimeIST(earning.accepted_at)}</span>
                  {earning.distance_km > 0 && (
                    <>
                      <span>•</span>
                      <span>{earning.distance_km.toFixed(1)} km</span>
                    </>
                  )}
                  {earning.is_peak_hour && (
                    <>
                      <span>•</span>
                      <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-600 py-0">Peak</Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right ml-3">
                <div className="font-semibold text-primary">
                  {formatCurrency(earning.actual_payout ?? earning.expected_payout)}
                </div>
                {earning.status === 'pending' && (
                  <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Expected
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
