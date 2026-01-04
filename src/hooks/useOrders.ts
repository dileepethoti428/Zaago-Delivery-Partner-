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
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to accept order');
      
      return data;
    },
    onError: () => {
      toast.error('Failed to accept order');
    },
    onSuccess: () => {
      // Invalidate and refetch orders to show updated list with agent's new order
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['earnings'] });
      toast.success('Order accepted successfully!');
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
