import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, Calendar, TrendingUp } from 'lucide-react';
import { formatCurrency, PeriodEarnings } from '@/services/earnings';
import { motion } from 'framer-motion';

interface EarningsSummaryCardProps {
  title: string;
  data: PeriodEarnings;
  variant?: 'featured' | 'compact';
  delay?: number;
  icon?: React.ReactNode;
  showAveragePerOrder?: boolean;
}

export function EarningsSummaryCard({ 
  title, 
  data, 
  variant = 'compact',
  delay = 0,
  icon,
  showAveragePerOrder = false
}: EarningsSummaryCardProps) {
  const isFeatured = variant === 'featured';
  const avgPerOrder = data.deliveries > 0 ? data.total / data.deliveries : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className={`rounded-2xl ${isFeatured ? 'border-2 bg-gradient-to-br from-primary/10 to-primary/5' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {icon || (isFeatured ? <Calendar className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />)}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <IndianRupee className={isFeatured ? "h-6 w-6 text-primary" : "h-5 w-5 text-primary"} />
            <span className={isFeatured ? "text-3xl font-bold" : "text-2xl font-bold"}>
              {formatCurrency(data.total)}
            </span>
          </div>
          
          {/* Average per order for regular orders */}
          {showAveragePerOrder && data.deliveries > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Avg. per order: {formatCurrency(avgPerOrder)}
            </div>
          )}
          
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
                <div className="text-xs text-muted-foreground">Cancelled</div>
                <div className="text-lg font-semibold text-red-600">
                  {data.cancelled}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Delivered:</span>
                <span className="font-medium text-foreground">{data.deliveries}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-medium text-orange-600">{data.in_progress}</span>
              </div>
              <div className="flex justify-between">
                <span>Cancelled:</span>
                <span className="font-medium text-red-600">{data.cancelled}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
