import { supabase } from '@/integrations/supabase/client';
import { cache } from '@/utils/cache';
import { advancedCache } from '@/utils/advancedCache';
import { queryClient } from '@/providers/AppProviders';
import { stopOrdersRealtime, useOrdersStore } from '@/store/orders';
import { useLocationStore } from '@/store/location';
import { useAppStore } from '@/store/app';
import { agentSession } from '@/utils/agentSession';
import { onesignalLogout } from '@/utils/onesignal';

// All known localStorage keys to clear on logout
const STORAGE_KEYS_TO_CLEAR = [
  // Profile and agent data
  'agent_profile_cache',
  'assigned_orders_cache',
  'earnings_cache',
  'agent_location_cache',
  'last_location_update_time',
  'is_agent_online',
  'agent_id',
  'auth_session',
  'inflight_flags',
  'last_api_call_timestamps',
  // Location keys
  'zaago_last_loc',
  // Any other app-specific keys
  'sb-auth-token',
] as const;

/**
 * Comprehensive logout cleanup utility
 * Clears all local storage, resets all stores, stops realtime subscriptions
 * Ensures app behaves as fresh launch for next login
 */
export async function cleanupOnLogout(): Promise<void> {
  console.log('🧹 Starting logout cleanup...');

  try {
    // 1. Stop all realtime subscriptions FIRST (critical!)
    stopOrdersRealtime();
    console.log('✅ Realtime subscriptions stopped');
  } catch (e) {
    console.warn('Failed to stop realtime:', e);
  }

  try {
    // 2. Stop geolocation watch
    useLocationStore.getState().stopWatch();
    console.log('✅ Geolocation watch stopped');
  } catch (e) {
    console.warn('Failed to stop location watch:', e);
  }

  try {
    // 3. Logout from OneSignal
    onesignalLogout();
    console.log('✅ OneSignal logged out');
  } catch (e) {
    console.warn('Failed to logout from OneSignal:', e);
  }

  try {
    // 4. Clear all localStorage caches
    cache.clearAll(); // Clears all zaago_cache_* keys (agent-aware)
    advancedCache.clear(); // Clears zaago_v2_* keys
    
    // Clear agent session tracking
    agentSession.clearCurrentAgentId();
    
    // Clear additional specific keys
    STORAGE_KEYS_TO_CLEAR.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key}:`, e);
      }
    });
    
    // Clear ALL zaago-prefixed keys (safety net)
    Object.keys(localStorage)
      .filter(key => key.startsWith('zaago'))
      .forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove ${key}:`, e);
        }
      });
    console.log('✅ Local storage cleared');
  } catch (e) {
    console.warn('Failed to clear storage:', e);
  }

  try {
    // 5. Clear TanStack Query cache
    queryClient.clear();
    console.log('✅ Query cache cleared');
  } catch (e) {
    console.warn('Failed to clear query cache:', e);
  }

  try {
    // 6. Reset Zustand stores to initial state
    useOrdersStore.getState().reset();
    useLocationStore.getState().reset();
    useAppStore.setState({
      isAuthed: false,
      agent: null,
      orders: [],
    });
    console.log('✅ Zustand stores reset');
  } catch (e) {
    console.warn('Failed to reset stores:', e);
  }

  try {
    // 7. Sign out from Supabase (clears auth tokens)
    await supabase.auth.signOut();
    console.log('✅ Supabase auth signed out');
  } catch (e) {
    console.warn('Failed to sign out from Supabase:', e);
  }

  console.log('🧹 Logout cleanup complete!');
}
