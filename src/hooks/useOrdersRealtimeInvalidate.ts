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

    // Use unique channel name per agent to avoid conflicts
    const channel = supabase
      .channel(`agent-orders-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          console.log('🔄 Realtime order change:', {
            event: payload.eventType,
            orderId: newRecord?.id || oldRecord?.id,
            newStatus: newRecord?.status,
            newAgentId: newRecord?.agent_id
          });
          
          // For UPDATE events, check if assignment or status changed
          if (payload.eventType === 'UPDATE') {
            const assignmentChanged = 
              newRecord.agent_id !== oldRecord.agent_id ||
              newRecord.assigned_agent_id !== oldRecord.assigned_agent_id;
            const statusChanged = newRecord.status !== oldRecord.status;
            
            if (assignmentChanged || statusChanged) {
              // Immediately remove this order from cache if it's now assigned to someone else
              if (newRecord.agent_id && newRecord.agent_id !== agentId) {
                queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => {
                  if (!Array.isArray(old)) return old;
                  return old.filter((o: any) => o.id !== newRecord.id);
                });
              }
            }
          }
          
          // Invalidate to refetch fresh data for all order changes
          queryClient.invalidateQueries({ queryKey: ['orders', agentId] });
          queryClient.invalidateQueries({ queryKey: ['assigned-orders'] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('📡 Cleaning up realtime channel for agent:', agentId);
      supabase.removeChannel(channel); // 🔥 CRITICAL cleanup
    };
  }, [agentId, queryClient]);
}
