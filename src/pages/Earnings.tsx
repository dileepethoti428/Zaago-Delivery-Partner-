import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, TrendingUp, Calendar, Loader2, Package } from 'lucide-react';
import { motion as m } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { fetchLiveEarnings, formatCurrency } from '@/services/earnings';
import { cache } from '@/utils/cache';
import { useToast } from '@/hooks/use-toast';

interface EarningsState {
  today: number;
  week: number;
  month: number;
  todayDeliveries: number;
  weekDeliveries: number;
  monthDeliveries: number;
  todayPending: number;
  weekPending: number;
  monthPending: number;
  todayCancelled: number;
  weekCancelled: number;
  monthCancelled: number;
}

export default function Earnings() {
  const user = useAuthStore((state) => state.user);
  const { toast } = useToast();
  const [earningsData, setEarningsData] = useState<EarningsState>({
    today: 0,
    week: 0,
    month: 0,
    todayDeliveries: 0,
    weekDeliveries: 0,
    monthDeliveries: 0,
    todayPending: 0,
    weekPending: 0,
    monthPending: 0,
    todayCancelled: 0,
    weekCancelled: 0,
    monthCancelled: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEarnings() {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      // Load from cache first for instant display
      const cached = cache.get<EarningsState>('LIVE_EARNINGS');
      if (cached) {
        setEarningsData(cached);
        setLoading(true); // Show cached data while fetching fresh
      }

      try {
        const liveData = await fetchLiveEarnings();
        
        const newData: EarningsState = {
          today: liveData.today.total,
          week: liveData.week.total,
          month: liveData.month.total,
          todayDeliveries: liveData.today.deliveries,
          weekDeliveries: liveData.week.deliveries,
          monthDeliveries: liveData.month.deliveries,
          todayPending: liveData.today.in_progress,
          weekPending: liveData.week.in_progress,
          monthPending: liveData.month.in_progress,
          todayCancelled: liveData.today.cancelled,
          weekCancelled: liveData.week.cancelled,
          monthCancelled: liveData.month.cancelled,
        };
        
        cache.set('LIVE_EARNINGS', newData);
        setEarningsData(newData);
      } catch (err) {
        console.error('Failed to load earnings:', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load earnings data',
        });
      } finally {
        setLoading(false);
      }
    }

    loadEarnings();
  }, [user?.email, toast]);
  return (
    <motion.div initial={pageTransition.initial} animate={pageTransition.animate} exit={pageTransition.exit} transition={pageTransitionConfig} className="h-full">
      <AppShell>
      <div className="space-y-6 py-4">
        <h1 className="text-2xl font-bold">Earnings</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {/* Today's Earnings - Featured Card */}
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0, ease: [0.4, 0, 0.2, 1] }}
              >
                <Card className="rounded-2xl border-2 bg-gradient-to-br from-primary/10 to-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Today's Earnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <IndianRupee className="h-6 w-6 text-primary" />
                      <span className="text-3xl font-bold">
                        {formatCurrency(earningsData.today)}
                      </span>
                    </div>
                    
                    {/* Today's Stats Row */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Completed</div>
                        <div className="text-lg font-semibold text-green-600">
                          {earningsData.todayDeliveries}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Pending</div>
                        <div className="text-lg font-semibold text-orange-600">
                          {earningsData.todayPending}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Cancelled</div>
                        <div className="text-lg font-semibold text-red-600">
                          {earningsData.todayCancelled}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </m.div>

              {/* Week and Month Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* This Week */}
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
                >
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-1">
                        <IndianRupee className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold">
                          {formatCurrency(earningsData.week)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Delivered:</span>
                          <span className="font-medium text-foreground">{earningsData.weekDeliveries}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <span className="font-medium text-orange-600">{earningsData.weekPending}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cancelled:</span>
                          <span className="font-medium text-red-600">{earningsData.weekCancelled}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>

                {/* This Month */}
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
                >
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-1">
                        <IndianRupee className="h-5 w-5 text-primary" />
                        <span className="text-2xl font-bold">
                          {formatCurrency(earningsData.month)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Delivered:</span>
                          <span className="font-medium text-foreground">{earningsData.monthDeliveries}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <span className="font-medium text-orange-600">{earningsData.monthPending}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cancelled:</span>
                          <span className="font-medium text-red-600">{earningsData.monthCancelled}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>
              </div>
            </div>

            {/* Delivery Statistics Summary */}
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Delivery Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {earningsData.monthDeliveries}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Total Delivered
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">
                        {earningsData.monthPending}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        In Progress
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {earningsData.monthCancelled}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Cancelled
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </m.div>

            {/* Performance Chart */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Chart
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 rounded-xl flex items-end justify-center p-4">
                  <div className="flex items-end gap-2 h-full w-full max-w-xs">
                    {[40, 65, 45, 80, 60, 90, 70].map((height, i) => (
                      <m.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                        className="flex-1 bg-primary rounded-t"
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
    </motion.div>
  );
}
