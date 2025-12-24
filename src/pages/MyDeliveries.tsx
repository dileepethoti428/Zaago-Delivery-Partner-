import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { AssignedOrderCard } from '@/components/order/AssignedOrderCard';
import { useAssignedOrders } from '@/hooks/useAssignedOrders';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { getTodayIST, getTomorrowIST } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';

type DateFilter = 'today' | 'tomorrow' | 'upcoming' | 'all';

export default function MyDeliveries() {
  const navigate = useNavigate();
  const { data: orders = [], isLoading, error } = useAssignedOrders();
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // Calculate date strings using IST timezone (database stores dates in IST)
  const today = useMemo(() => getTodayIST(), []);
  const tomorrow = useMemo(() => getTomorrowIST(), []);

  // Get agent ID for debug display
  const [agentId, setAgentId] = useState<string | null>(null);
  useMemo(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAgentId(data.user?.id || null);
    });
  }, []);

  // Filter orders based on selected date tab
  const filteredOrders = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return orders.filter(o => o.date === today);
      case 'tomorrow':
        return orders.filter(o => o.date === tomorrow);
      case 'upcoming':
        return orders.filter(o => o.date > tomorrow);
      case 'all':
        return orders;
      default:
        return orders;
    }
  }, [orders, dateFilter, today, tomorrow]);

  // Count orders per filter
  const counts = useMemo(() => ({
    today: orders.filter(o => o.date === today).length,
    tomorrow: orders.filter(o => o.date === tomorrow).length,
    upcoming: orders.filter(o => o.date > tomorrow).length,
    all: orders.length,
  }), [orders, today, tomorrow]);

  const handleViewOrder = (order: typeof orders[0]) => {
    // Use dailyOrderId (which is the daily_orders.id) for navigation
    const navId = order.dailyOrderId || order.id;
    if (!navId) {
      toast.error('Order details not available');
      return;
    }
    navigate(`/manage-delivery/${navId}?type=daily`);
  };

  const formatDate = (dateStr: string) => {
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrow) return 'Tomorrow';
    const date = new Date(dateStr);
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
          <p>Query Date (IST): {today}</p>
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
        {!isLoading && !error && filteredOrders.length === 0 && (
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
        {!isLoading && !error && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {filteredOrders.map((order, index) => (
              <AssignedOrderCard
                key={order.id}
                order={order}
                index={index}
                dateLabel={dateFilter === 'all' ? formatDate(order.date) : undefined}
                onManage={() => handleViewOrder(order)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
