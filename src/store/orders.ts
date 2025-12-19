import { create } from 'zustand';
import type { ZaagoOrder } from '@/services/orders';
import { fetchOpenOrders, fetchAvailableOrders } from '@/services/orders';
import { supabase } from '@/integrations/supabase/client';
import { cache } from '@/utils/cache';
import { toast } from '@/hooks/use-toast';
import { agentSession } from '@/utils/agentSession';

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
  reset: () => void;
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

    const currentAgentId = agentSession.getCurrentAgentId();
    
    // Only use cache if same agent
    if (currentAgentId && agentId && currentAgentId === agentId) {
      const cached = cache.getForAgent<ZaagoOrder[]>('ORDERS', currentAgentId);
      if (cached) {
        set({ orders: cached, loading: true });
      } else {
        set({ loading: true, error: null });
      }
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
      
      // Save with agent ID if available
      if (agentId) {
        cache.setForAgent('ORDERS', filtered, agentId);
      }
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

  reset: () => {
    set({
      loading: false,
      error: null,
      orders: [],
      lastAgentId: undefined,
    });
  },
}));

// Initialize realtime subscription
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let currentAgentIdForRealtime: string | null = null;

export function startOrdersRealtime(agentId?: string) {
  // Store the agent ID for filtering
  if (agentId) {
    currentAgentIdForRealtime = agentId;
  }
  
  if (realtimeChannel) return;

  console.log('📡 Starting orders realtime subscription for agent:', currentAgentIdForRealtime);

  realtimeChannel = supabase
    .channel('orders-realtime')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        const updatedOrder = payload.new as any;
        const orderId = updatedOrder.id;
        const newStatus = updatedOrder.status;
        const assignedAgentId = updatedOrder.agent_id;
        
        console.log('📡 Realtime UPDATE:', { orderId, newStatus, assignedAgentId, currentAgent: currentAgentIdForRealtime });
        
        // Rule: If order is assigned to someone else, REMOVE INSTANTLY
        // No re-fetch, no polling - just remove from local state
        if (assignedAgentId && assignedAgentId !== currentAgentIdForRealtime) {
          console.log('🗑️ Order assigned to another agent - removing instantly');
          useOrdersStore.setState((state) => ({
            orders: state.orders.filter((o) => o.id !== orderId),
          }));
        }
        
        // If order status changed to something not available, remove it
        if (newStatus && !['accepted', 'packed'].includes(newStatus) && !assignedAgentId) {
          console.log('🗑️ Order status changed to unavailable - removing');
          useOrdersStore.setState((state) => ({
            orders: state.orders.filter((o) => o.id !== orderId),
          }));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        // New order - could optionally add to list, but for now just log
        console.log('📡 Realtime INSERT - new order available:', payload.new);
        // User can refresh to see new orders
      }
    )
    .subscribe((status) => {
      console.log('📡 Realtime subscription status:', status);
    });
}

export function stopOrdersRealtime() {
  if (realtimeChannel) {
    console.log('📡 Stopping orders realtime subscription');
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  currentAgentIdForRealtime = null;
}
