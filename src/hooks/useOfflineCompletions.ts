import { useState, useEffect } from 'react';
import { 
  getOfflineCompletions, 
  addOfflineCompletion, 
  getAgentPayouts,
  getTotalPendingCompletions,
  OfflineCompletion 
} from '@/lib/offlineCompletions';
import { useToast } from '@/hooks/use-toast';

export const useOfflineCompletions = () => {
  const [completions, setCompletions] = useState<OfflineCompletion[]>([]);
  const [payouts, setPayouts] = useState({ totalEarnings: 0, pendingEarnings: 0, lastUpdated: null });
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();

  const refreshData = () => {
    setCompletions(getOfflineCompletions());
    setPayouts(getAgentPayouts());
    setPendingCount(getTotalPendingCompletions());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const completeOrderOffline = async (
    order: any,
    paymentMethod: 'COD' | 'Online',
    distance: number,
    payout: number,
    agentEmail: string
  ) => {
    try {
      const completion: OfflineCompletion = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderId: order.id,
        customerName: order.customer_name,
        totalAmount: order.total,
        paymentMethod,
        completedAt: new Date().toISOString(),
        agentEmail,
        distance,
        payout,
        customerPhone: order.customer_phone,
        address: order.address,
        items: order.items,
        status: 'completed'
      };

      addOfflineCompletion(completion);
      refreshData();

      toast({
        title: "✅ Delivery Completed Offline!",
        description: `Order saved locally. Payout: ₹${payout}. Will sync when connection is stable.`,
        variant: "default"
      });

      return { success: true };
    } catch (error) {
      console.error('Error completing order offline:', error);
      toast({
        title: "Error",
        description: "Failed to save completion offline",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  return {
    completions,
    payouts,
    pendingCount,
    completeOrderOffline,
    refreshData
  };
};