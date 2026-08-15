import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { AssignedOrderCard } from '@/components/order/AssignedOrderCard';
import { useTodayOrders, useTomorrowOrders, useDeliveredOrders, useCompensationOrders, istDateString } from '@/hooks/useAssignedOrders';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Package, Search, X, ChevronDown, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { useScreenLocationSync } from '@/hooks/useScreenLocationSync';
import { getDistanceKm } from '@/utils/geo';
import { CodCollectionCard } from '@/components/delivery/CodCollectionCard';
import { PickupSummaryCard } from '@/components/delivery/PickupSummaryCard';
import { completeCompensationOrder, type AssignedOrder } from '@/services/assignedOrders';


type DateFilter = 'today' | 'tomorrow' | 'delivered' | 'all';
type TimeFilter = 'morning' | 'evening' | 'all';

function bucketOf(slot?: string | null): 'morning' | 'evening' | null {
  if (!slot || typeof slot !== 'string') return null;
  const s = slot.trim().toLowerCase();
  if (s.startsWith('morning')) return 'morning';
  if (s.startsWith('evening')) return 'evening';
  return null;
}

function getDefaultTimeBucket(): TimeFilter {
  const h = new Date().getHours();
  if (h >= 5 && h < 16) return 'morning';
  if (h >= 16 && h < 22) return 'evening';
  return 'all';
}

export default function MyDeliveries() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => getDefaultTimeBucket());
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  // Start location sync on this screen
  useScreenLocationSync();

  // Each query is enabled ONLY for its active tab — one RPC call at a time.
  // Previously-fetched tabs remain cached (staleTime: 30s) so switching back is instant.
  const { data: todayOrders = [], isLoading: loadingToday, error: errorToday } = useTodayOrders(dateFilter === 'today' || dateFilter === 'all');
  const { data: tomorrowOrders = [], isLoading: loadingTomorrow, error: errorTomorrow } = useTomorrowOrders(dateFilter === 'tomorrow' || dateFilter === 'all');
  const { data: deliveredOrders = [], isLoading: loadingDelivered, error: errorDelivered } = useDeliveredOrders(dateFilter === 'delivered');

  // Compensation (make-up) deliveries live in vacation_compensations, fetched separately
  const todayISO = istDateString(0);
  const tomorrowISO = istDateString(1);
  const {
    data: todayComps = [],
    isLoading: loadingTodayComps,
    error: errorTodayComps,
  } = useCompensationOrders(todayISO, dateFilter === 'today' || dateFilter === 'all');
  const {
    data: tomorrowComps = [],
    isLoading: loadingTomorrowComps,
    error: errorTomorrowComps,
  } = useCompensationOrders(tomorrowISO, dateFilter === 'tomorrow' || dateFilter === 'all');
  const queryClient = useQueryClient();



  // Sort orders by distance from seller shop, vacation orders at end
  const sortByDistance = (orders: AssignedOrder[]): AssignedOrder[] => {
    return orders.map(order => {
      const custLat = order.deliveryLatitude ?? order.customerLatitude;
      const custLng = order.deliveryLongitude ?? order.customerLongitude;
      let dist: number | null = null;
      if (order.sellerLatitude && order.sellerLongitude && custLat && custLng) {
        dist = Math.round(getDistanceKm(
          { lat: order.sellerLatitude, lng: order.sellerLongitude },
          { lat: custLat, lng: custLng }
        ) * 100) / 100;
      }
      return { ...order, distanceFromShop: dist };
    }).sort((a, b) => {
      // Vacation orders always at end
      if (a.isOnVacation !== b.isOnVacation) return a.isOnVacation ? 1 : -1;
      // Orders without distance go after those with distance
      if (a.distanceFromShop == null && b.distanceFromShop == null) return 0;
      if (a.distanceFromShop == null) return 1;
      if (b.distanceFromShop == null) return -1;
      return a.distanceFromShop - b.distanceFromShop;
    });
  };

  // Current orders based on selected tab - sorted by distance (compensations merged in)
  const currentOrders = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return sortByDistance([...todayOrders, ...todayComps]);
      case 'tomorrow':
        return sortByDistance([...tomorrowOrders, ...tomorrowComps]);
      case 'delivered':
        return deliveredOrders; // No sorting for delivered
      case 'all':
        return sortByDistance([...todayOrders, ...todayComps, ...tomorrowOrders, ...tomorrowComps]);
      default:
        return sortByDistance([...todayOrders, ...todayComps]);
    }
  }, [dateFilter, todayOrders, tomorrowOrders, deliveredOrders, todayComps, tomorrowComps]);


  // Loading state for current tab
  const isLoading = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return loadingToday || loadingTodayComps;
      case 'tomorrow':
        return loadingTomorrow || loadingTomorrowComps;
      case 'delivered':
        return loadingDelivered;
      case 'all':
        return loadingToday || loadingTodayComps || loadingTomorrow || loadingTomorrowComps;
      default:
        return loadingToday || loadingTodayComps;
    }
  }, [dateFilter, loadingToday, loadingTodayComps, loadingTomorrow, loadingTomorrowComps, loadingDelivered]);

  // Error state for current tab
  const error = useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return errorToday || errorTodayComps;
      case 'tomorrow':
        return errorTomorrow || errorTomorrowComps;
      case 'delivered':
        return errorDelivered;
      case 'all':
        return errorToday || errorTodayComps || errorTomorrow || errorTomorrowComps;
      default:
        return errorToday || errorTodayComps;
    }
  }, [dateFilter, errorToday, errorTodayComps, errorTomorrow, errorTomorrowComps, errorDelivered]);

  // Counts from RPC results - NO FRONTEND DATE COMPARISON
  const counts = useMemo(() => ({
    today: todayOrders.length + todayComps.length,
    tomorrow: tomorrowOrders.length + tomorrowComps.length,
    delivered: deliveredOrders.length,
    all: todayOrders.length + todayComps.length + tomorrowOrders.length + tomorrowComps.length,
  }), [todayOrders, tomorrowOrders, deliveredOrders, todayComps, tomorrowComps]);

  // Time-of-day filter applied on top of the date-tab list
  const timeFilteredOrders = useMemo(() => {
    if (dateFilter === 'delivered') return currentOrders;
    if (timeFilter === 'all') return currentOrders;
    return currentOrders.filter(o => bucketOf(o.deliveryTimeSlot) === timeFilter);
  }, [currentOrders, timeFilter, dateFilter]);

  const timeCounts = useMemo(() => {
    let morning = 0, evening = 0;
    for (const o of currentOrders) {
      const b = bucketOf(o.deliveryTimeSlot);
      if (b === 'morning') morning++;
      else if (b === 'evening') evening++;
    }
    return { morning, evening, all: currentOrders.length };
  }, [currentOrders]);

  // Client-side search filter (applied on top of time filter)
  const filteredOrders = useMemo(() => {
    if (!search.trim()) return timeFilteredOrders;
    const q = search.trim().toLowerCase();
    const toStr = (v: unknown) => (typeof v === 'string' ? v : v ? JSON.stringify(v) : '');
    return timeFilteredOrders.filter(order =>
      toStr(order.customerName).toLowerCase().includes(q) ||
      toStr(order.deliveryAddress).toLowerCase().includes(q) ||
      toStr(order.customerAddress).toLowerCase().includes(q) ||
      toStr(order.productName).toLowerCase().includes(q) ||
      toStr(order.sellerName).toLowerCase().includes(q)
    );
  }, [timeFilteredOrders, search]);

  const handleViewOrder = async (order: AssignedOrder) => {
    // Compensation deliveries use the normal Manage Delivery flow
    if (order.isCompensation) {
      navigate(`/manage-delivery/${order.id}?type=compensation`);
      return;
    }
    const navId = order.dailyOrderId || order.id;
    if (!navId) {
      toast.error('Order details not available');
      return;
    }
    navigate(`/manage-delivery/${navId}?type=daily`);
  };


  // Format date label for "all" tab - uses IST timezone
  const formatDateLabel = (dateStr: string) => {
    // Handle date-only strings by appending midnight
    const date = dateStr.includes('T') 
      ? new Date(dateStr)
      : new Date(dateStr + 'T00:00:00');
    
    return date.toLocaleDateString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* COD Collection Card */}
        <CodCollectionCard />

        {/* Pickup Summary - only for non-delivered tabs */}
        {dateFilter !== 'delivered' && (
          <PickupSummaryCard
            orders={currentOrders}
            label={dateFilter === 'today' ? 'Today' : dateFilter === 'tomorrow' ? 'Tomorrow' : 'All'}
          />
        )}

        {/* Date Filter Tabs */}
        <Tabs value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setSearch(''); setVisibleCount(5); }}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today" className="text-xs">
              Today ({counts.today})
            </TabsTrigger>
            <TabsTrigger value="tomorrow" className="text-xs">
              Tomorrow ({counts.tomorrow})
            </TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">
              Delivered ({counts.delivered})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              All ({counts.all})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Time-of-Day Filter */}
        {dateFilter !== 'delivered' && (
          <Tabs value={timeFilter} onValueChange={(v) => { setTimeFilter(v as TimeFilter); setVisibleCount(5); }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="morning" className="text-xs">
                Morning ({timeCounts.morning})
              </TabsTrigger>
              <TabsTrigger value="evening" className="text-xs">
                Evening ({timeCounts.evening})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">
                All ({timeCounts.all})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Search Bar */}
        {!isLoading && !error && currentOrders.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by customer, address, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

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

        {/* Empty State — no orders at all */}
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
              {dateFilter === 'delivered' && 'No deliveries completed today'}
              {dateFilter === 'all' && 'No assigned deliveries'}
            </p>
          </motion.div>
        )}

        {/* Empty State — search or time filter returned nothing */}
        {!isLoading && !error && currentOrders.length > 0 && filteredOrders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10"
          >
            {search.trim() ? (
              <>
                <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold text-foreground mb-1">No results</h3>
                <p className="text-sm text-muted-foreground">No orders match "{search}"</p>
              </>
            ) : timeFilter === 'morning' && dateFilter !== 'delivered' ? (
              <>
                <Sun className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold text-foreground mb-1">No morning orders</h3>
                <p className="text-sm text-muted-foreground">No deliveries scheduled for this morning</p>
              </>
            ) : timeFilter === 'evening' && dateFilter !== 'delivered' ? (
              <>
                <Moon className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold text-foreground mb-1">No evening orders</h3>
                <p className="text-sm text-muted-foreground">No deliveries scheduled for this evening</p>
              </>
            ) : (
              <>
                <Search className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold text-foreground mb-1">No results</h3>
                <p className="text-sm text-muted-foreground">No orders match the current filters</p>
              </>
            )}
          </motion.div>
        )}

        {/* Orders List */}
        {!isLoading && !error && filteredOrders.length > 0 && (() => {
          const displayedOrders = search ? filteredOrders : filteredOrders.slice(0, visibleCount);
          const hasMore = !search && filteredOrders.length > visibleCount;
          return (
            <>
              <div className="space-y-3">
                {displayedOrders.map((order, index) => (
                  <AssignedOrderCard
                    key={order.id}
                    order={order}
                    index={index}
                    dateLabel={dateFilter === 'all' ? formatDateLabel(order.date) : undefined}
                    onManage={() => handleViewOrder(order)}
                  />
                ))}
              </div>
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVisibleCount((prev) => prev + 5)}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  View More ({filteredOrders.length - visibleCount} remaining)
                </Button>
              )}
            </>
          );
        })()}
      </div>
    </AppShell>
  );
}
