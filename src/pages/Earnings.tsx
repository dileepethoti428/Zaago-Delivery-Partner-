import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, TrendingUp, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const earningsData = {
  today: 850,
  week: 5240,
  month: 21850,
};

const recentOrders = [
  { id: 'ZA-10340', date: '2024-01-15', distance: 4.2, payout: 85 },
  { id: 'ZA-10339', date: '2024-01-15', distance: 8.5, payout: 105 },
  { id: 'ZA-10338', date: '2024-01-14', distance: 6.1, payout: 95 },
  { id: 'ZA-10337', date: '2024-01-14', distance: 12.3, payout: 145 },
  { id: 'ZA-10336', date: '2024-01-13', distance: 3.8, payout: 75 },
];

export default function Earnings() {
  return (
    <AppShell>
      <div className="space-y-6 py-4">
        <h1 className="text-2xl font-bold">Earnings</h1>

        <div className="grid gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Card className="rounded-2xl border-2 bg-gradient-to-br from-primary/10 to-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-6 w-6 text-primary" />
                  <span className="text-3xl font-bold">{earningsData.today}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    <IndianRupee className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{earningsData.week}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    <IndianRupee className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{earningsData.month}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

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
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex-1 bg-primary rounded-t"
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{order.id}</p>
                    <p className="text-sm text-muted-foreground">{order.date} • {order.distance} km</p>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-green-600">
                    <IndianRupee className="h-4 w-4" />
                    {order.payout}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
