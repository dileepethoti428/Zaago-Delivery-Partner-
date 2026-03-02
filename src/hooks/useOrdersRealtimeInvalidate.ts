import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Realtime order updates — uses direct cache mutation (setQueryData) instead of
 * invalidateQueries to prevent refetch loops and render storms on mobile.
 */
export function useOrdersRealtimeInvalidate(agentId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel(`agent-orders-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          const orderId = newRecord?.id || oldRecord?.id;

          console.log('🔄 Realtime order change:', {
            event: payload.eventType,
            orderId,
            newStatus: newRecord?.status,
          });

          if (payload.eventType === 'UPDATE') {
            const statusChanged = newRecord.status !== oldRecord.status;
            const assignmentChanged =
              newRecord.agent_id !== oldRecord.agent_id ||
              newRecord.assigned_agent_id !== oldRecord.assigned_agent_id;

            if (statusChanged || assignmentChanged) {
              const terminalStatuses = ['delivered', 'completed', 'cancelled', 'canceled'];
              const isTerminal = terminalStatuses.includes((newRecord.status ?? '').toLowerCase());
              const takenByOther = newRecord.agent_id && newRecord.agent_id !== agentId;

              // Directly remove from cache — no refetch needed for simple removals
              if (isTerminal || takenByOther) {
                queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => {
                  if (!Array.isArray(old)) return old;
                  return old.filter((o: any) => o.id !== orderId);
                });
                return; // Skip invalidation — cache is already correct
              }
            }
          }

          if (payload.eventType === 'DELETE') {
            queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.filter((o: any) => o.id !== orderId);
            });
            return;
          }

          // For INSERT or complex UPDATEs — do a single targeted invalidation
          queryClient.invalidateQueries({ queryKey: ['orders', agentId] });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, queryClient]);
}
