import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { EarningsByType } from '@/services/earnings';
import { EarningsSummaryCard } from './EarningsSummaryCard';
import { RecentEarningsList } from './RecentEarningsList';
import { motion } from 'framer-motion';

interface EarningsTabContentProps {
  data: EarningsByType;
  type: 'regular' | 'subscription';
}

export function EarningsTabContent({ data, type }: EarningsTabContentProps) {
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
              {typeLabel} Statistics (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {data.month.deliveries}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Delivered
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {data.month.in_progress}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  In Progress
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {data.month.cancelled}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Cancelled
                </div>
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
