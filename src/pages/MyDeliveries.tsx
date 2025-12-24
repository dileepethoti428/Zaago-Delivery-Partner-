import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { AssignedOrderCard } from '@/components/order/AssignedOrderCard';
import { useAssignedOrders } from '@/hooks/useAssignedOrders';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Calendar } from 'lucide-react';

type DateFilter = 'today' | 'tomorrow' | 'upcoming' | 'all';

export default function MyDeliveries() {
  const navigate = useNavigate();
  const { data: orders = [], isLoading, error } = useAssignedOrders();
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // Calculate date strings
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
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

  const handleViewOrder = (orderId: string) => {
    navigate(`/manage-delivery/${orderId}?type=daily`);
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
                onManage={() => handleViewOrder(order.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
