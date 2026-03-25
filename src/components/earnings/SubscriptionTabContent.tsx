import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { EarningsByType } from '@/services/earnings';
import { SubscriptionDeliverySummaryCard } from './SubscriptionDeliverySummaryCard';
import { SubscriptionDeliveryList } from './SubscriptionDeliveryList';
import { motion } from 'framer-motion';

interface SubscriptionTabContentProps {
  data: EarningsByType;
  allTimeDeliveries?: number;
}

export function SubscriptionTabContent({ data, allTimeDeliveries }: SubscriptionTabContentProps) {
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

      {/* All Time Deliveries Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <Card className="rounded-2xl border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                  <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">All Time Deliveries</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {allTimeDeliveries ?? 0}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <RefreshCw className="h-8 w-8 text-amber-300 dark:text-amber-700 ml-auto" />
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">Subscriptions</p>
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
