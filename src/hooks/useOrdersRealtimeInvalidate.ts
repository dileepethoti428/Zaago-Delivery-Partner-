import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to subscribe to realtime order updates and invalidate React Query cache.
 * This ensures the orders list stays fresh when orders are assigned/updated.
 */
export function useOrdersRealtimeInvalidate(agentId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel('orders-realtime-invalidate')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          // Check if assignment or status changed
          const assignmentChanged = 
            newRecord.agent_id !== oldRecord.agent_id ||
            newRecord.assigned_agent_id !== oldRecord.assigned_agent_id;
          const statusChanged = newRecord.status !== oldRecord.status;
          
          if (assignmentChanged || statusChanged) {
            console.log('🔄 Order changed, invalidating cache:', {
              orderId: newRecord.id,
              newStatus: newRecord.status,
              newAgentId: newRecord.agent_id,
              assignmentChanged,
              statusChanged
            });
            
            // Immediately remove this order from cache if it's now assigned to someone else
            if (newRecord.agent_id && newRecord.agent_id !== agentId) {
              queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => {
                if (!Array.isArray(old)) return old;
                return old.filter((o: any) => o.id !== newRecord.id);
              });
            }
            
            // Also invalidate to refetch fresh data
            queryClient.invalidateQueries({ queryKey: ['orders', agentId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, queryClient]);
}
