import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { AssignedOrderCard } from '@/components/order/AssignedOrderCard';
import { useTodayOrders, useTomorrowOrders, useUpcomingOrders } from '@/hooks/useAssignedOrders';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type DateFilter = 'today' | 'tomorrow' | 'upcoming' | 'all';

export default function MyDeliveries() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [agentId, setAgentId] = useState<string | null>(null);

  // Use separate RPC hooks for each tab - NO FRONTEND DATE LOGIC
  const { data: todayOrders = [], isLoading: loadingToday, error: errorToday } = useTodayOrders();
  const { data: tomorrowOrders = [], isLoading: loadingTomorrow, error: errorTomorrow } = useTomorrowOrders();
  const { data: upcomingOrders = [], isLoading: loadingUpcoming, error: errorUpcoming } = useUpcomingOrders();

  // Get agent ID for debug display
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAgentId(data.user?.id || null);
    });
  }, []);

  // Current orders based on selected tab - NO DATE FILTERING, just tab selection
  const currentOrders = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return todayOrders;
      case 'tomorrow':
        return tomorrowOrders;
      case 'upcoming':
        return upcomingOrders;
      case 'all':
        return [...todayOrders, ...tomorrowOrders, ...upcomingOrders];
      default:
        return todayOrders;
    }
  }, [dateFilter, todayOrders, tomorrowOrders, upcomingOrders]);

  // Loading state for current tab
  const isLoading = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return loadingToday;
      case 'tomorrow':
        return loadingTomorrow;
      case 'upcoming':
        return loadingUpcoming;
      case 'all':
        return loadingToday || loadingTomorrow || loadingUpcoming;
      default:
        return loadingToday;
    }
  }, [dateFilter, loadingToday, loadingTomorrow, loadingUpcoming]);

  // Error state for current tab
  const error = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return errorToday;
      case 'tomorrow':
        return errorTomorrow;
      case 'upcoming':
        return errorUpcoming;
      case 'all':
        return errorToday || errorTomorrow || errorUpcoming;
      default:
        return errorToday;
    }
  }, [dateFilter, errorToday, errorTomorrow, errorUpcoming]);

  // Counts from RPC results - NO FRONTEND DATE COMPARISON
  const counts = useMemo(() => ({
    today: todayOrders.length,
    tomorrow: tomorrowOrders.length,
    upcoming: upcomingOrders.length,
    all: todayOrders.length + tomorrowOrders.length + upcomingOrders.length,
  }), [todayOrders, tomorrowOrders, upcomingOrders]);

  const handleViewOrder = (order: typeof todayOrders[0]) => {
    const navId = order.dailyOrderId || order.id;
    if (!navId) {
      toast.error('Order details not available');
      return;
    }
    navigate(`/manage-delivery/${navId}?type=daily`);
  };

  // Format date label for "all" tab - uses order.date directly from DB
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Debug Info - TEMPORARY */}
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded mb-2">
          <p>Agent ID: {agentId ? `${agentId.slice(0, 8)}...` : 'Loading...'}</p>
          <p>Date Source: Postgres CURRENT_DATE (no frontend date logic)</p>
        </div>

        {/* Date Filter Tabs */}
        <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today" className="text-xs">
              Today ({counts.today})
            </TabsTrigger>
            <TabsTrigger value="tomorrow" className="text-xs">
              Tomorrow ({counts.tomorrow})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs">
              Upcoming ({counts.upcoming})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              All ({counts.all})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-destructive">
            <p>Failed to load orders</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && currentOrders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No deliveries</h3>
            <p className="text-sm text-muted-foreground">
              {dateFilter === 'today' && 'No deliveries assigned for today'}
              {dateFilter === 'tomorrow' && 'No deliveries assigned for tomorrow'}
              {dateFilter === 'upcoming' && 'No upcoming deliveries'}
              {dateFilter === 'all' && 'No assigned deliveries'}
            </p>
          </motion.div>
        )}

        {/* Orders List */}
        {!isLoading && !error && currentOrders.length > 0 && (
          <div className="space-y-3">
            {currentOrders.map((order, index) => (
              <AssignedOrderCard
                key={order.id}
                order={order}
                index={index}
                dateLabel={dateFilter === 'all' ? formatDateLabel(order.date) : undefined}
                onManage={() => handleViewOrder(order)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
