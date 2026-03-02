import { useLifecycleStore } from '@/store/lifecycle';
import { useOrdersStore } from '@/store/orders';
import { supabase } from '@/integrations/supabase/client';

const RESUME_DEBOUNCE_MS = 30000; // 30 seconds — prevents double-fire from visibilitychange + focus
const SHORT_BACKGROUND_MS = 5 * 60 * 1000; // 5 minutes — skip heavy resume for quick nav-app trips
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000; // 60 seconds — only refresh if token expires within 1 min

let lastResumeTime = 0;
let lastBackgroundTime = 0; // Track when app went to background

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
  // Debounce rapid resume events (30s — prevents visibilitychange + focus double-fire)
  const now = Date.now();
  if (now - lastResumeTime < RESUME_DEBOUNCE_MS) {
    console.log('[AppLifecycle] Resume debounced, skipping');
    return;
  }
  lastResumeTime = now;

  // Calculate how long the app was in the background
  const backgroundDuration = lastBackgroundTime > 0 ? now - lastBackgroundTime : SHORT_BACKGROUND_MS + 1;
  const isShortResume = backgroundDuration < SHORT_BACKGROUND_MS;

  console.log(`[AppLifecycle] App resumed (background: ${Math.round(backgroundDuration / 1000)}s, short: ${isShortResume})`);

  // Always unstick the UI — safe and fast, no network calls
  resetAllLoaders();
  unlockAllButtons();

  // For short resumes (e.g. returning from Google Maps), skip heavy operations
  if (isShortResume) {
    console.log('[AppLifecycle] Short resume — skipping session refresh and query invalidation');
    return;
  }

  // Guard: only run heavy resume logic when a session is active
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    console.log('[AppLifecycle] App resumed - no session, skipping reset');
    return;
  }

  console.log('[AppLifecycle] Long resume — running full resume logic');

  // 3. Refresh session only if token is expiring soon
  await refreshSession();

  // 4. Invalidate stale queries (soft refresh)
  refreshQueries();
}

/**
 * Record when app goes to background — used for short-resume detection
 */
export function onAppBackground() {
  lastBackgroundTime = Date.now();
  console.log('[AppLifecycle] App backgrounded');
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
 * Smart session refresh — only refresh if token is expiring soon
 * Avoids unnecessary network calls on every resume
 */
export async function refreshSession() {
  try {
    // Check current session first — no network call
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData?.session) {
      console.log('[AppLifecycle] No active session');
      return;
    }

    // Only refresh if token expires within 60 seconds
    const expiresAt = sessionData.session.expires_at; // Unix timestamp in seconds
    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = expiresAt ? expiresAt - nowSeconds : 0;

    if (secondsUntilExpiry > TOKEN_EXPIRY_BUFFER_MS / 1000) {
      console.log(`[AppLifecycle] Token valid for ${secondsUntilExpiry}s — skipping refresh`);
      return;
    }

    console.log(`[AppLifecycle] Token expires in ${secondsUntilExpiry}s — refreshing`);

    // Use Promise.race to prevent hanging on slow networks (4s timeout)
    const refreshPromise = supabase.auth.refreshSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session refresh timeout')), 4000)
    );

    const { data, error } = await Promise.race([refreshPromise, timeoutPromise]);
    
    if (error) {
      console.warn('[AppLifecycle] Session refresh error:', error);
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
    } else {
      // Record background time for short-resume detection
      onAppBackground();
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
