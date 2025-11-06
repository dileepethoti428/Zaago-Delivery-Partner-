import { create } from 'zustand';
import type { ZaagoOrder } from '@/services/orders';
import { fetchOpenOrders, fetchAvailableOrders } from '@/services/orders';
import { supabase } from '@/integrations/supabase/client';
import { cache } from '@/utils/cache';
import { toast } from '@/hooks/use-toast';

type OrdersState = {
  loading: boolean;
  error: string | null;
  orders: ZaagoOrder[];
  lastAgentId?: string;
  load: (agentId?: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: ZaagoOrder['status']) => void;
  getOrderById: (id: string) => ZaagoOrder | undefined;
  acceptOrder: (orderId: string, agentId: string) => Promise<void>;
  rejectOrder: (orderId: string, agentId: string) => Promise<void>;
};

export const useOrdersStore = create<OrdersState>((set, get) => ({
  loading: false,
  error: null,
  orders: [],
  lastAgentId: undefined,
  
  async load(agentId?: string) {
    if (agentId) {
      set({ lastAgentId: agentId });
    }

    const cached = cache.get<ZaagoOrder[]>('ORDERS');
    if (cached) {
      set({ orders: cached, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    
    try {
      const rows = agentId 
        ? await fetchAvailableOrders(agentId)
        : await fetchOpenOrders();
        
      const filtered = rows.filter(r => 
        ['new', 'open', 'packed', 'assigned', 'picked_up'].includes((r.status ?? '').toLowerCase())
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
    
    // Store previous state for rollback
    const previousOrders = get().orders;
    
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
      
      // Show success toast
      toast({
        title: 'Success',
        description: 'Order accepted successfully',
      });
    } catch (error: any) {
      console.error('❌ Accept order failed:', error);
      
      // Rollback on error
      set({ orders: previousOrders });
      
      // Show error toast
      toast({
        variant: 'destructive',
        title: 'Order accept failed',
        description: error?.message || 'Order accept failed, please try again',
      });
      
      throw error;
    }
  },

  rejectOrder: async (orderId, agentId) => {
    const { rejectOrder: rejectOrderService } = await import('@/services/acceptOrder');
    
    // Optimistic update - remove from view
    set((state) => ({
      orders: state.orders.filter((order) => order.id !== orderId),
    }));

    try {
      await rejectOrderService(orderId, agentId);
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
          const { lastAgentId } = useOrdersStore.getState();
          useOrdersStore.getState().load(lastAgentId);
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
