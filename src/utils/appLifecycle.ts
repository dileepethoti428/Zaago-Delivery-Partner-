import { useLifecycleStore } from '@/store/lifecycle';
import { useOrdersStore } from '@/store/orders';
import { supabase } from '@/integrations/supabase/client';

let lastResumeTime = 0;
const RESUME_DEBOUNCE_MS = 2000;

// Import queryClient dynamically to avoid circular dependency
let queryClientRef: any = null;

export function setQueryClientRef(client: any) {
  queryClientRef = client;
}

/**
 * Master function called when app resumes from background
 * Resets all stuck states and refreshes data
 */
export async function onAppResume() {
  // Debounce rapid resume events
  const now = Date.now();
  if (now - lastResumeTime < RESUME_DEBOUNCE_MS) return;
  lastResumeTime = now;

  // Guard: only run resume logic when a session is active
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    console.log('[AppLifecycle] App resumed - no session, skipping reset');
    return;
  }

  console.log('[AppLifecycle] App resumed - resetting state');

  // 1. Reset all loading states
  resetAllLoaders();

  // 2. Unlock all buttons (force-enable)
  unlockAllButtons();

  // 3. Refresh session (check if still valid)
  await refreshSession();

  // 4. Invalidate stale queries (soft refresh)
  refreshQueries();
}

/**
 * Reset ALL loading states across the app
 */
export function resetAllLoaders() {
  // Reset global lifecycle store
  useLifecycleStore.getState().resetAllLoaders();
  
  // Reset orders store loading
  const ordersStore = useOrdersStore.getState();
  if (ordersStore.loading) {
    useOrdersStore.setState({ loading: false });
  }

  console.log('[AppLifecycle] All loaders reset');
}

/**
 * Force-enable all disabled buttons
 * Safety net for buttons stuck in disabled state
 */
export function unlockAllButtons() {
  const buttons = document.querySelectorAll('button[disabled]');
  let unlocked = 0;
  
  buttons.forEach((btn) => {
    const button = btn as HTMLButtonElement;
    
    // Skip navigation/tab buttons that should stay disabled
    if (button.getAttribute('data-state') === 'inactive') return;
    
    // Skip buttons with role="tab" as they manage their own state
    if (button.getAttribute('role') === 'tab') return;
    
    // Remove disabled attribute - React will re-disable if needed
    button.removeAttribute('disabled');
    unlocked++;
  });

  if (unlocked > 0) {
    console.log(`[AppLifecycle] Unlocked ${unlocked} stuck buttons`);
  }
}

/**
 * Refresh/validate the current session
 */
export async function refreshSession() {
  try {
    // Use Promise.race to prevent hanging on slow networks (4s timeout)
    const refreshPromise = supabase.auth.refreshSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session refresh timeout')), 4000)
    );

    const { data, error } = await Promise.race([refreshPromise, timeoutPromise]);
    
    if (error) {
      console.warn('[AppLifecycle] Session refresh error:', error);
      const { data: fallback } = await supabase.auth.getSession();
      if (!fallback.session) {
        console.log('[AppLifecycle] No active session');
      }
      return;
    }
    
    if (!data.session) {
      console.log('[AppLifecycle] No active session after refresh');
      return;
    }

    console.log('[AppLifecycle] Session refreshed successfully');
  } catch (e) {
    console.warn('[AppLifecycle] Session refresh failed (timeout or network):', e);
  }
}

/**
 * Soft-refresh React Query cache
 * Marks queries as stale so they refetch when accessed
 */
export function refreshQueries() {
  if (!queryClientRef) {
    console.warn('[AppLifecycle] QueryClient not initialized');
    return;
  }
  
  // Invalidate order-related queries (most likely to be stale)
  queryClientRef.invalidateQueries({ queryKey: ['orders'] });
  queryClientRef.invalidateQueries({ queryKey: ['available-orders'] });
  queryClientRef.invalidateQueries({ queryKey: ['assigned-orders'] });
  queryClientRef.invalidateQueries({ queryKey: ['order-details'] });
  queryClientRef.invalidateQueries({ queryKey: ['earnings'] });
  
  console.log('[AppLifecycle] Queries invalidated');
}

/**
 * Setup global event listeners for app resume
 * Call once during app initialization
 */
let listenersInitialized = false;

export function setupAppLifecycleListeners() {
  if (listenersInitialized) {
    console.log('[AppLifecycle] Listeners already initialized, skipping');
    return;
  }
  listenersInitialized = true;

  // Visibility change (tab focus, app resume)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onAppResume();
    }
  });

  // Window focus (returning from external apps)
  window.addEventListener('focus', () => {
    onAppResume();
  });

  // Page show (back/forward navigation, bfcache restore)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      onAppResume();
    }
  });

  console.log('[AppLifecycle] Listeners initialized');
}
