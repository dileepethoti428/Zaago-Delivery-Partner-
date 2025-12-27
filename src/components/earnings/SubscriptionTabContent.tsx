import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, RefreshCw } from 'lucide-react';
import { EarningsByType } from '@/services/earnings';
import { SubscriptionDeliverySummaryCard } from './SubscriptionDeliverySummaryCard';
import { SubscriptionDeliveryList } from './SubscriptionDeliveryList';
import { motion } from 'framer-motion';

interface SubscriptionTabContentProps {
  data: EarningsByType;
}

export function SubscriptionTabContent({ data }: SubscriptionTabContentProps) {
  return (
    <div className="space-y-4">
      {/* Today's Deliveries - Featured - NO earnings */}
      <SubscriptionDeliverySummaryCard
        title="Today's Subscription Deliveries"
        data={data.today}
        variant="featured"
        delay={0}
        icon={<RefreshCw className="h-4 w-4 text-purple-600" />}
      />

      {/* Week and Month Cards - Delivery counts only */}
      <div className="grid grid-cols-2 gap-4">
        <SubscriptionDeliverySummaryCard
          title="This Week"
          data={data.week}
          variant="compact"
          delay={0.1}
        />
        <SubscriptionDeliverySummaryCard
          title="This Month"
          data={data.month}
          variant="compact"
          delay={0.2}
        />
      </div>

      {/* Delivery Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Subscription Delivery Statistics (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {data.month.deliveries}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Completed
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {data.month.in_progress}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Pending
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {data.month.cancelled}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Skipped
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Deliveries - NO payout info */}
      <SubscriptionDeliveryList
        deliveries={data.recent_earnings}
        delay={0.4}
      />
    </div>
  );
}
