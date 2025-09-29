import { useState, useEffect, useCallback } from 'react';
import { 
  getOfflineCompletions, 
  addOfflineCompletion, 
  getAgentPayouts,
  getTotalPendingCompletions,
  updateCompletionStatus,
  clearSyncedCompletions,
  OfflineCompletion 
} from '@/lib/offlineCompletions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useOfflineCompletions = () => {
  const [completions, setCompletions] = useState<OfflineCompletion[]>([]);
  const [payouts, setPayouts] = useState({ totalEarnings: 0, pendingEarnings: 0, lastUpdated: null });
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const refreshData = () => {
    setCompletions(getOfflineCompletions());
    setPayouts(getAgentPayouts());
    setPendingCount(getTotalPendingCompletions());
  };

  const syncOfflineCompletions = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    
    const currentCompletions = getOfflineCompletions();
    const pendingCompletions = currentCompletions.filter(c => c.status === 'completed');
    if (pendingCompletions.length === 0) return;
    
    setIsSyncing(true);
    console.log(`🔄 Syncing ${pendingCompletions.length} offline completions...`);
    
    let syncedCount = 0;
    
    for (const completion of pendingCompletions) {
      try {
        // Try to sync with the safe-complete-delivery function
        const { data, error } = await supabase.functions.invoke('safe-complete-delivery', {
          body: {
            order_id: completion.orderId,
            payment_method: completion.paymentMethod,
            agent_email: completion.agentEmail,
            offline_completion_id: completion.id
          }
        });
        
        if (error) throw error;
        
        // Mark as synced
        updateCompletionStatus(completion.id, 'synced');
        syncedCount++;
        
        console.log(`✅ Synced completion: ${completion.id}`);
        
      } catch (error) {
        console.error(`❌ Failed to sync completion ${completion.id}:`, error);
        updateCompletionStatus(completion.id, 'failed');
      }
    }
    
    if (syncedCount > 0) {
      toast({
        title: "✅ Sync Complete",
        description: `${syncedCount} deliveries synced with server`,
        variant: "default"
      });
      
      // Clear synced completions and refresh data
      clearSyncedCompletions();
      refreshData();
    }
    
    setIsSyncing(false);
  }, [isOnline, isSyncing, toast]);

  useEffect(() => {
    refreshData();
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineCompletions();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Try to sync on component mount if online (delayed to avoid dependency issue)
    const syncTimeout = setTimeout(() => {
      if (navigator.onLine) {
        syncOfflineCompletions();
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(syncTimeout);
    };
  }, [syncOfflineCompletions]);

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
    isOnline,
    isSyncing,
    completeOrderOffline,
    refreshData,
    syncOfflineCompletions
  };
};