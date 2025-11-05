import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { motion as m } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { fetchAgentProfile } from '@/services/agentProfile';
import { fetchAgentEarnings, computeEarningsTotals } from '@/services/earnings';

export default function Earnings() {
  const { user } = useAuthStore();
  const [earningsData, setEarningsData] = useState({ today: 0, week: 0, month: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEarnings() {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      try {
        // First get agent profile to get agent_id
        const agentProfile = await fetchAgentProfile(user.email);
        
        if (!agentProfile?.id) {
          console.error('Agent profile not found');
          setLoading(false);
          return;
        }

        // Fetch earnings data
        const earningsRows = await fetchAgentEarnings(agentProfile.id);
        
        // Compute totals
        const totals = computeEarningsTotals(earningsRows);
        setEarningsData(totals);
      } catch (err) {
        console.error('Failed to load earnings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEarnings();
  }, [user?.email]);
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
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, ease: [0.4, 0, 0.2, 1] }}
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
          </m.div>

          <div className="grid grid-cols-2 gap-4">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
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
            </m.div>

            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
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
            </m.div>
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
