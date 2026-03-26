import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAvailableOrders } from '@/services/orders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useOrders = (agentId?: string, isScreenActive = false) => {
  return useQuery({
    queryKey: ['orders', agentId],
    queryFn: () => fetchAvailableOrders(agentId!),
    enabled: !!agentId && isScreenActive,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useAcceptOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, agentId }: { orderId: string; agentId: string }) => {
      const { data, error } = await supabase.functions.invoke('accept-order', {
        body: { order_id: orderId, agent_id: agentId }
      });
      
      // Handle actual HTTP/network errors
      if (error) {
        console.error('Accept order HTTP error:', error);
        throw new Error(error.message || 'Network error while accepting order');
      }
      
      // Now data is always returned (200 OK) - check success flag
      if (!data?.success) {
        const errorCode = data?.error_code;
        
        // Controlled conflict - throw with special prefix for onError handler
        if (errorCode === 'ORDER_ALREADY_ACCEPTED') {
          throw new Error('ORDER_TAKEN:Order already taken by another agent');
        }
        if (errorCode === 'ORDER_NOT_AVAILABLE') {
          throw new Error('ORDER_UNAVAILABLE:Order is no longer available');
        }
        
        // Other failures
        throw new Error(data?.error || 'Failed to accept order');
      }
      
      return data;
    },
    onError: (error: Error, variables) => {
      const isTaken = error.message?.startsWith('ORDER_TAKEN:');
      const isUnavailable = error.message?.startsWith('ORDER_UNAVAILABLE:');
      
      if (isTaken) {
        toast.error('Order already taken by another agent');
      } else if (isUnavailable) {
        toast.error('Order is no longer available');
      } else {
        toast.error('Failed to accept order');
      }
      
      // Remove the order from cache immediately for better UX (any conflict)
      if (isTaken || isUnavailable) {
        queryClient.setQueriesData({ queryKey: ['orders'] }, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.filter((o: any) => o.id !== variables.orderId);
        });
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
