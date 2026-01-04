import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAvailableOrders } from '@/services/orders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useOrders = (agentId?: string) => {
  return useQuery({
    queryKey: ['orders', agentId],
    queryFn: () => fetchAvailableOrders(agentId!),
    enabled: !!agentId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: 'always', // Always refetch on mount to show fresh data after navigation
    refetchOnWindowFocus: true,
  });
};

export const useAcceptOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, agentId }: { orderId: string; agentId: string }) => {
      const { data, error } = await supabase.functions.invoke('accept-order', {
        body: { order_id: orderId, agent_id: agentId }
      });
      
      // Handle HTTP errors (including 409)
      if (error) {
        // Try to extract error details from the response
        const errorCode = (error as any)?.context?.error_code || 'UNKNOWN_ERROR';
        const is409 = (error as any)?.status === 409 || error.message?.includes('409');
        
        if (is409 || errorCode === 'ORDER_ALREADY_ACCEPTED' || errorCode === 'ORDER_NOT_AVAILABLE') {
          throw new Error('ORDER_CONFLICT:' + (error.message || 'Order no longer available'));
        }
        throw error;
      }
      
      if (!data?.success) {
        const errorCode = data?.error_code;
        if (errorCode === 'ORDER_ALREADY_ACCEPTED' || errorCode === 'ORDER_NOT_AVAILABLE') {
          throw new Error('ORDER_CONFLICT:' + (data?.error || 'Order no longer available'));
        }
        throw new Error(data?.error || 'Failed to accept order');
      }
      
      return data;
    },
    onError: (error: Error, variables) => {
      const isConflict = error.message?.startsWith('ORDER_CONFLICT:');
      
      if (isConflict) {
        toast.error('Order already taken by another agent');
        // Remove the order from cache immediately for better UX
        queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => 
          old?.filter((o: any) => o.id !== variables.orderId)
        );
      } else {
        toast.error('Failed to accept order');
      }
      
      // Always invalidate to get fresh data
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onSuccess: (data) => {
      // Invalidate and refetch orders to show updated list with agent's new order
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['earnings'] });
      
      // Only show toast if not already assigned (avoid double toast on retry)
      if (!data?.already_assigned) {
        toast.success('Order accepted successfully!');
      }
    },
  });
};

export const useRejectOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, agentId }: { orderId: string; agentId: string }) => {
      const { error } = await supabase
        .from('agent_order_rejections')
        .insert({
          agent_id: agentId,
          order_id: orderId,
          rejection_type: 'manual',
        });
      
      if (error) throw error;
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData(['orders']);
      
      queryClient.setQueryData(['orders'], (old: any) =>
        old?.filter((o: any) => o.id !== orderId)
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['orders'], context?.previous);
      toast.error('Failed to reject order');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
