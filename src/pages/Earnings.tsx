import { useState } from 'react';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Loader2, Package, ShoppingBag, RefreshCw } from 'lucide-react';
import { motion as m } from 'framer-motion';
import { useEarnings } from '@/hooks/useEarnings';
import { formatCurrency } from '@/services/earnings';
import { EarningsSummaryCard } from '@/components/earnings/EarningsSummaryCard';
import { RecentEarningsList } from '@/components/earnings/RecentEarningsList';
import { EarningsTabContent } from '@/components/earnings/EarningsTabContent';
import { SubscriptionTabContent } from '@/components/earnings/SubscriptionTabContent';

export default function Earnings() {
  const { data: earningsData, isLoading: loading, isFetching } = useEarnings();
  const showLoader = loading && isFetching;
  const [activeTab, setActiveTab] = useState('all');

  return (
    <motion.div initial={pageTransition.initial} animate={pageTransition.animate} exit={pageTransition.exit} transition={pageTransitionConfig} className="h-full">
      <AppShell>
        <div className="space-y-4 py-4">
          <h1 className="text-2xl font-bold">Earnings</h1>

          {showLoader ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all" className="text-xs sm:text-sm">
                  All
                </TabsTrigger>
                <TabsTrigger value="regular" className="text-xs sm:text-sm">
                  <ShoppingBag className="h-3 w-3 mr-1 hidden sm:inline" />
                  Regular
                </TabsTrigger>
                <TabsTrigger value="subscription" className="text-xs sm:text-sm">
                  <RefreshCw className="h-3 w-3 mr-1 hidden sm:inline" />
                  Deliveries
                </TabsTrigger>
              </TabsList>

              {/* All Earnings Tab */}
              <TabsContent value="all" className="space-y-4 mt-0">
                {/* Today's Earnings - Featured Card */}
                <EarningsSummaryCard
                  title="Today's Earnings"
                  data={earningsData?.today || { pending: 0, confirmed: 0, total: 0, deliveries: 0, in_progress: 0, cancelled: 0, total_orders: 0 }}
                  variant="featured"
                  delay={0}
                  icon={<Calendar className="h-4 w-4" />}
                />

                {/* Week and Month Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <EarningsSummaryCard
                    title="This Week"
                    data={earningsData?.week || { pending: 0, confirmed: 0, total: 0, deliveries: 0, in_progress: 0, cancelled: 0, total_orders: 0 }}
                    variant="compact"
                    delay={0.1}
                  />
                  <EarningsSummaryCard
                    title="This Month"
                    data={earningsData?.month || { pending: 0, confirmed: 0, total: 0, deliveries: 0, in_progress: 0, cancelled: 0, total_orders: 0 }}
                    variant="compact"
                    delay={0.2}
                  />
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
                        Delivery Statistics (This Month)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {earningsData?.month.deliveries || 0}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Total Delivered
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-600">
                            {earningsData?.month.in_progress || 0}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            In Progress
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600">
                            {earningsData?.month.cancelled || 0}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Cancelled
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>

                {/* Order Type Breakdown */}
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
                >
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Earnings by Order Type (This Month)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <ShoppingBag className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Regular Orders</span>
                          </div>
                          <div className="text-xl font-bold text-blue-600">
                            {formatCurrency(earningsData?.regular?.month.total || 0)}
                          </div>
                          <div className="text-xs text-blue-600/70 mt-1">
                            {earningsData?.regular?.month.deliveries || 0} deliveries
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center gap-2 mb-2">
                            <RefreshCw className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Subscriptions</span>
                          </div>
                          <div className="text-xl font-bold text-purple-600">
                            {earningsData?.subscription?.month.deliveries || 0}
                          </div>
                          <div className="text-xs text-purple-600/70 mt-1">
                            Deliveries Completed
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </m.div>

                {/* Recent Deliveries */}
                <RecentEarningsList
                  earnings={earningsData?.recent_earnings || []}
                  type="all"
                  delay={0.4}
                />
              </TabsContent>

              {/* Regular Orders Tab */}
              <TabsContent value="regular" className="mt-0">
                {earningsData?.regular ? (
                  <EarningsTabContent data={earningsData.regular} type="regular" />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No regular order earnings data available</p>
                  </div>
                )}
              </TabsContent>

              {/* Subscription Deliveries Tab - NO earnings display */}
              <TabsContent value="subscription" className="mt-0">
                {earningsData?.subscription ? (
                  <SubscriptionTabContent data={earningsData.subscription} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No subscription deliveries data available</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </AppShell>
    </motion.div>
  );
}
