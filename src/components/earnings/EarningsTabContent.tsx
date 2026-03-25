import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag, TrendingUp } from 'lucide-react';
import { EarningsByType } from '@/services/earnings';
import { EarningsSummaryCard } from './EarningsSummaryCard';
import { RecentEarningsList } from './RecentEarningsList';
import { motion } from 'framer-motion';

interface EarningsTabContentProps {
  data: EarningsByType;
  type: 'regular' | 'subscription';
  allTimeDeliveries?: number;
}

export function EarningsTabContent({ data, type, allTimeDeliveries }: EarningsTabContentProps) {
  const typeLabel = type === 'subscription' ? 'Subscription' : 'Regular Order';

  return (
    <div className="space-y-4">
      {/* Today's Earnings - Featured */}
      <EarningsSummaryCard
        title={`Today's ${typeLabel} Earnings`}
        data={data.today}
        variant="featured"
        delay={0}
        showAveragePerOrder={type === 'regular'}
      />

      {/* Week and Month Cards */}
      <div className="grid grid-cols-2 gap-4">
        <EarningsSummaryCard
          title="This Week"
          data={data.week}
          variant="compact"
          delay={0.1}
        />
        <EarningsSummaryCard
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
                <ShoppingBag className="h-8 w-8 text-amber-300 dark:text-amber-700 ml-auto" />
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">Regular orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Deliveries */}
      <RecentEarningsList
        earnings={data.recent_earnings}
        type={type}
        delay={0.4}
      />
    </div>
  );
}
