import { create } from 'zustand';
import type { ZaagoOrder } from '@/services/orders';
import { fetchOpenOrders } from '@/services/orders';
import { supabase } from '@/integrations/supabase/client';
import { cache } from '@/utils/cache';

type OrdersState = {
  loading: boolean;
  error: string | null;
  orders: ZaagoOrder[];
  load: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: ZaagoOrder['status']) => void;
  getOrderById: (id: string) => ZaagoOrder | undefined;
  acceptOrder: (orderId: string, agentId: string) => Promise<void>;
  rejectOrder: (orderId: string) => Promise<void>;
};

export const useOrdersStore = create<OrdersState>((set, get) => ({
  loading: false,
  error: null,
  orders: [],
  
  async load() {
    const cached = cache.get<ZaagoOrder[]>('ORDERS');
    if (cached) {
      set({ orders: cached, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    
    try {
      const rows = await fetchOpenOrders();
      const filtered = rows.filter(r => 
        ['new', 'open', 'packed'].includes((r.status ?? '').toLowerCase())
      );
      cache.set('ORDERS', filtered);
      set({ orders: filtered, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load orders', loading: false });
    }
  },

  updateOrderStatus: (orderId, status) => {
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? { ...order, status, updatedAt: Date.now() }
          : order
      ),
    }));
  },

  getOrderById: (id) => get().orders.find(order => order.id === id),

  acceptOrder: async (orderId, agentId) => {
    const { acceptOrder: acceptOrderService } = await import('@/services/acceptOrder');
    
    // Optimistic update
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId
          ? { ...order, status: 'assigned' as ZaagoOrder['status'], updatedAt: Date.now() }
          : order
      ),
    }));

    try {
      await acceptOrderService(orderId, agentId);
    } catch (error: any) {
      // Rollback on error
      set((state) => ({
        orders: state.orders.map((order) =>
          order.id === orderId
            ? { ...order, status: 'packed' as ZaagoOrder['status'] }
            : order
        ),
      }));
      throw error;
    }
  },

  rejectOrder: async (orderId) => {
    const { rejectOrder: rejectOrderService } = await import('@/services/acceptOrder');
    
    // Optimistic update - remove from view
    set((state) => ({
      orders: state.orders.filter((order) => order.id !== orderId),
    }));

    try {
      await rejectOrderService(orderId);
    } catch (error: any) {
      // Reload orders on error
      await get().load();
      throw error;
    }
  },
}));

// Initialize realtime subscription
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

export function startOrdersRealtime() {
  if (realtimeChannel) return;

  realtimeChannel = supabase
    .channel('orders-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => {
        // Debounce reload to avoid excessive refreshes
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          useOrdersStore.getState().load();
        }, 400);
      }
    )
    .subscribe();
}

export function stopOrdersRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
