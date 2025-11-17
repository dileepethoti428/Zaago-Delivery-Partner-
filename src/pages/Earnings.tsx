import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, Calendar, Loader2, Package } from 'lucide-react';
import { motion as m } from 'framer-motion';
import { useEarnings } from '@/hooks/useEarnings';
import { formatCurrency } from '@/services/earnings';

export default function Earnings() {
  const { data: earningsData, isLoading: loading } = useEarnings();

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
                        {formatCurrency(earningsData?.today.total || 0)}
                      </span>
                    </div>
                    
                    {/* Today's Stats Row */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Completed</div>
                        <div className="text-lg font-semibold text-green-600">
                          {earningsData?.today.deliveries || 0}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Pending</div>
                        <div className="text-lg font-semibold text-orange-600">
                          {earningsData?.today.in_progress || 0}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Cancelled</div>
                        <div className="text-lg font-semibold text-red-600">
                          {earningsData?.today.cancelled || 0}
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
                          {formatCurrency(earningsData?.week.total || 0)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Delivered:</span>
                          <span className="font-medium text-foreground">{earningsData?.week.deliveries || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <span className="font-medium text-orange-600">{earningsData?.week.in_progress || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cancelled:</span>
                          <span className="font-medium text-red-600">{earningsData?.week.cancelled || 0}</span>
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
                          {formatCurrency(earningsData?.month.total || 0)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Delivered:</span>
                          <span className="font-medium text-foreground">{earningsData?.month.deliveries || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending:</span>
                          <span className="font-medium text-orange-600">{earningsData?.month.in_progress || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cancelled:</span>
                          <span className="font-medium text-red-600">{earningsData?.month.cancelled || 0}</span>
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

          </>
        )}
      </div>
    </AppShell>
    </motion.div>
  );
}
