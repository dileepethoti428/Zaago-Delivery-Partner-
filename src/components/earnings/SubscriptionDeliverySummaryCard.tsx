import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, TrendingUp, Package } from 'lucide-react';
import { PeriodEarnings } from '@/services/earnings';
import { motion } from 'framer-motion';

interface SubscriptionDeliverySummaryCardProps {
  title: string;
  data: PeriodEarnings;
  variant?: 'featured' | 'compact';
  delay?: number;
  icon?: React.ReactNode;
}

export function SubscriptionDeliverySummaryCard({ 
  title, 
  data, 
  variant = 'compact',
  delay = 0,
  icon
}: SubscriptionDeliverySummaryCardProps) {
  const isFeatured = variant === 'featured';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className={`rounded-2xl ${isFeatured ? 'border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {icon || (isFeatured ? <Calendar className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />)}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Delivery count - NO currency symbol */}
          <div className="flex items-center gap-2">
            <Package className={isFeatured ? "h-6 w-6 text-purple-600" : "h-5 w-5 text-purple-600"} />
            <span className={isFeatured ? "text-3xl font-bold text-purple-700 dark:text-purple-400" : "text-2xl font-bold text-purple-700 dark:text-purple-400"}>
              {data.deliveries}
            </span>
            <span className={isFeatured ? "text-lg text-muted-foreground" : "text-sm text-muted-foreground"}>
              {data.deliveries === 1 ? 'Delivery' : 'Deliveries'}
            </span>
          </div>
          
          {/* Stats Row */}
          {isFeatured ? (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Completed</div>
                <div className="text-lg font-semibold text-green-600">
                  {data.deliveries}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="text-lg font-semibold text-orange-600">
                  {data.in_progress}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Skipped</div>
                <div className="text-lg font-semibold text-red-600">
                  {data.cancelled}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-medium text-foreground">{data.deliveries}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-medium text-orange-600">{data.in_progress}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped:</span>
                <span className="font-medium text-red-600">{data.cancelled}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
