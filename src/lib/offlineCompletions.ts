// Offline completion queue management
export interface OfflineCompletion {
  id: string;
  orderId: string;
  customerName: string;
  totalAmount: number;
  paymentMethod: 'COD' | 'Online';
  completedAt: string;
  agentEmail: string;
  distance: number;
  payout: number;
  customerPhone?: string;
  address?: any;
  items?: any[];
  status: 'completed' | 'synced' | 'failed';
}

const STORAGE_KEY = 'zaago_offline_completions';
const PAYOUT_STORAGE_KEY = 'zaago_agent_payouts';

export const getOfflineCompletions = (): OfflineCompletion[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading offline completions:', error);
    return [];
  }
};

export const addOfflineCompletion = (completion: OfflineCompletion): void => {
  try {
    const completions = getOfflineCompletions();
    completions.push(completion);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
    
    // Update agent payout tracking
    updateAgentPayouts(completion.payout);
  } catch (error) {
    console.error('Error saving offline completion:', error);
  }
};

export const updateCompletionStatus = (id: string, status: OfflineCompletion['status']): void => {
  try {
    const completions = getOfflineCompletions();
    const updated = completions.map(c => c.id === id ? { ...c, status } : c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error updating completion status:', error);
  }
};

export const getAgentPayouts = () => {
  try {
    const stored = localStorage.getItem(PAYOUT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : { totalEarnings: 0, pendingEarnings: 0, lastUpdated: null };
  } catch (error) {
    console.error('Error reading agent payouts:', error);
    return { totalEarnings: 0, pendingEarnings: 0, lastUpdated: null };
  }
};

export const updateAgentPayouts = (amount: number): void => {
  try {
    const current = getAgentPayouts();
    const updated = {
      totalEarnings: current.totalEarnings + amount,
      pendingEarnings: current.pendingEarnings + amount,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(PAYOUT_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error updating agent payouts:', error);
  }
};

export const clearSyncedCompletions = (): void => {
  try {
    const completions = getOfflineCompletions();
    const pending = completions.filter(c => c.status !== 'synced');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch (error) {
    console.error('Error clearing synced completions:', error);
  }
};

export const getTotalPendingCompletions = (): number => {
  return getOfflineCompletions().filter(c => c.status === 'completed').length;
};