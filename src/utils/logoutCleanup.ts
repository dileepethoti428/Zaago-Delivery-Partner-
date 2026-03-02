import { supabase } from '@/integrations/supabase/client';
import { cache } from '@/utils/cache';
import { advancedCache } from '@/utils/advancedCache';
import { queryClient } from '@/providers/AppProviders';
import { useOrdersStore } from '@/store/orders';
import { useLocationStore } from '@/store/location';
import { agentSession } from '@/utils/agentSession';
import { resetFCMState } from '@/utils/fcm';

// All known localStorage keys to clear on logout
const STORAGE_KEYS_TO_CLEAR = [
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
  'zaago_last_loc',
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
    useLocationStore.getState().stopWatch();
    console.log('✅ Geolocation watch stopped');
  } catch (e) {
    console.warn('Failed to stop location watch:', e);
  }

  try {
    resetFCMState();
    console.log('✅ FCM state reset');
  } catch (e) {
    console.warn('Failed to reset FCM state:', e);
  }

  try {
    cache.clearAll();
    advancedCache.clear();
    agentSession.clearCurrentAgentId();
    
    STORAGE_KEYS_TO_CLEAR.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove ${key}:`, e);
      }
    });
    
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
    queryClient.clear();
    console.log('✅ Query cache cleared');
  } catch (e) {
    console.warn('Failed to clear query cache:', e);
  }

  try {
    useOrdersStore.getState().reset();
    useLocationStore.getState().reset();
    console.log('✅ Zustand stores reset');
  } catch (e) {
    console.warn('Failed to reset stores:', e);
  }

  try {
    await supabase.auth.signOut();
    console.log('✅ Supabase auth signed out');
  } catch (e) {
    console.warn('Failed to sign out from Supabase:', e);
  }

  console.log('🧹 Logout cleanup complete!');
}
