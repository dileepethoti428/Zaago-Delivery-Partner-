import { useLifecycleStore } from '@/store/lifecycle';
import { useOrdersStore } from '@/store/orders';
import { supabase } from '@/integrations/supabase/client';

let lastResumeTime = 0;
const RESUME_DEBOUNCE_MS = 500;
const SESSION_REFRESH_TIMEOUT_MS = 4000;

// Import queryClient dynamically to avoid circular dependency
let queryClientRef: any = null;

export function setQueryClientRef(client: any) {
  queryClientRef = client;
}

/**
 * Promise.race wrapper — resolves/rejects within timeoutMs no matter what.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[AppLifecycle] ${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Exported so ManageDelivery (and others) can do a safe session refresh
 * without blocking forever.
 */
export async function safeRefreshSession(timeoutMs = SESSION_REFRESH_TIMEOUT_MS): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.refreshSession(),
      timeoutMs,
      'refreshSession'
    );
    if (error || !data?.session) {
      console.warn('[AppLifecycle] Session refresh issue:', error?.message ?? 'no session');
      return false;
    }
    console.log('[AppLifecycle] Session refreshed OK');
    return true;
  } catch (e: any) {
    console.warn('[AppLifecycle] Session refresh failed/timed out:', e?.message);
    return false;
  }
}

/**
 * Master function called when app resumes from background.
 * Resets all stuck states, refreshes session (with timeout), reconnects realtime, and invalidates queries.
 */
export async function onAppResume() {
  const now = Date.now();
  if (now - lastResumeTime < RESUME_DEBOUNCE_MS) return;
  lastResumeTime = now;

  console.log('[AppLifecycle] App resumed - resetting state');

  // 1. Reset all loading states immediately (non-blocking)
  resetAllLoaders();
  unlockAllButtons();

  // 2. Session refresh with timeout — never blocks more than SESSION_REFRESH_TIMEOUT_MS
  await safeRefreshSession();

  // 3. Reconnect realtime channels (they can go stale after background)
  try {
    supabase.realtime.disconnect();
    supabase.realtime.connect();
    console.log('[AppLifecycle] Realtime reconnected');
  } catch (e) {
    console.warn('[AppLifecycle] Realtime reconnect failed:', e);
  }

  // 4. Invalidate stale queries — always runs regardless of session outcome
  refreshQueries();
}

/**
 * Reset ALL loading states across the app
 */
export function resetAllLoaders() {
  useLifecycleStore.getState().resetAllLoaders();

  const ordersStore = useOrdersStore.getState();
  if (ordersStore.loading) {
    useOrdersStore.setState({ loading: false });
  }

  console.log('[AppLifecycle] All loaders reset');
}

/**
 * Force-enable all disabled buttons
 */
export function unlockAllButtons() {
  const buttons = document.querySelectorAll('button[disabled]');
  let unlocked = 0;

  buttons.forEach((btn) => {
    const button = btn as HTMLButtonElement;
    if (button.getAttribute('data-state') === 'inactive') return;
    if (button.getAttribute('role') === 'tab') return;
    button.removeAttribute('disabled');
    unlocked++;
  });

  if (unlocked > 0) {
    console.log(`[AppLifecycle] Unlocked ${unlocked} stuck buttons`);
  }
}

/**
 * Soft-refresh React Query cache
 */
export function refreshQueries() {
  if (!queryClientRef) {
    console.warn('[AppLifecycle] QueryClient not initialized');
    return;
  }

  queryClientRef.invalidateQueries({ queryKey: ['orders'] });
  queryClientRef.invalidateQueries({ queryKey: ['available-orders'] });
  queryClientRef.invalidateQueries({ queryKey: ['assigned-orders'] });
  queryClientRef.invalidateQueries({ queryKey: ['orderDetails'] }); // fixed key (was 'order-details')
  queryClientRef.invalidateQueries({ queryKey: ['earnings'] });

  console.log('[AppLifecycle] Queries invalidated');
}

/**
 * Setup global event listeners for app resume
 */
let listenersInitialized = false;

export function setupAppLifecycleListeners() {
  if (listenersInitialized) {
    console.log('[AppLifecycle] Listeners already initialized, skipping');
    return;
  }
  listenersInitialized = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onAppResume();
    }
  });

  window.addEventListener('focus', () => {
    onAppResume();
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      onAppResume();
    }
  });

  console.log('[AppLifecycle] Listeners initialized');
}
