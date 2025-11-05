import { create } from 'zustand';
import type { ZaagoOrder } from '@/services/orders';
import { fetchOpenOrders } from '@/services/orders';
import { supabase } from '@/integrations/supabase/client';

type OrdersState = {
  loading: boolean;
  error: string | null;
  orders: ZaagoOrder[];
  load: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: ZaagoOrder['status']) => void;
  getOrderById: (id: string) => ZaagoOrder | undefined;
};

export const useOrdersStore = create<OrdersState>((set, get) => ({
  loading: false,
  error: null,
  orders: [],
  
  async load() {
    set({ loading: true, error: null });
    try {
      const rows = await fetchOpenOrders();
      // Filter to show only new/open orders
      const filtered = rows.filter(r => 
        ['new', 'open'].includes((r.status ?? '').toLowerCase())
      );
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
}));

// Initialize realtime subscription
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function startOrdersRealtime() {
  if (realtimeChannel) return;

  realtimeChannel = supabase
    .channel('orders-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => {
        // Reload orders when any change happens
        useOrdersStore.getState().load();
      }
    )
    .subscribe();
}

export function stopOrdersRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}
