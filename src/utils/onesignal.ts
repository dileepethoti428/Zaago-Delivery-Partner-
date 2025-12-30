/**
 * OneSignal integration via Median JavaScript Bridge
 * External ID = user email
 */

declare global {
  interface Window {
    median?: {
      onesignal: {
        getDeviceState: () => Promise<{ isSubscribed: boolean; isPushDisabled: boolean }>;
        login: (externalId: string) => void;
        logout: () => void;
      };
    };
  }
}

// Track if login has been called to prevent duplicates
let loginInProgress = false;

/**
 * Check if running inside Median app
 */
export function isMedianApp(): boolean {
  return typeof window !== 'undefined' && typeof window.median !== 'undefined';
}

/**
 * Wait for OneSignal to be ready (poll device state)
 */
async function waitForOneSignalReady(maxAttempts = 10, intervalMs = 500): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const state = await window.median!.onesignal.getDeviceState();
      console.log(`[OneSignal] Device state check ${attempt}/${maxAttempts}:`, state);
      if (state) {
        console.log('[OneSignal] Ready ✓');
        return true;
      }
    } catch (e) {
      console.log(`[OneSignal] Not ready yet (attempt ${attempt}/${maxAttempts})`);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  console.warn('[OneSignal] Failed to become ready after max attempts');
  return false;
}

/**
 * Login user to OneSignal with email as external_id
 */
export async function onesignalLogin(email: string): Promise<void> {
  if (!isMedianApp()) {
    console.log('[OneSignal] Not in Median app, skipping');
    return;
  }

  // Prevent duplicate login attempts
  if (loginInProgress) {
    console.log('[OneSignal] Login already in progress, skipping');
    return;
  }

  loginInProgress = true;

  try {
    console.log('[OneSignal] Starting login flow for:', email);
    
    // Wait for OneSignal to be ready
    const isReady = await waitForOneSignalReady();
    if (!isReady) {
      console.error('[OneSignal] Login aborted - not ready');
      loginInProgress = false;
      return;
    }

    // Force logout any previous user first
    try {
      window.median!.onesignal.logout();
      console.log('[OneSignal] Previous user logged out');
      await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause
    } catch (e) {
      console.log('[OneSignal] No previous user to logout');
    }

    // Login with email as external_id
    window.median!.onesignal.login(email);
    console.log('[OneSignal] Login success ✓ - External ID:', email);
    
  } catch (error) {
    console.error('[OneSignal] Login failed:', error);
  } finally {
    loginInProgress = false;
  }
}

/**
 * Logout user from OneSignal
 */
export function onesignalLogout(): void {
  if (!isMedianApp()) {
    console.log('[OneSignal] Not in Median app, skipping logout');
    return;
  }

  try {
    window.median!.onesignal.logout();
    console.log('[OneSignal] Logout success ✓');
  } catch (error) {
    console.error('[OneSignal] Logout failed:', error);
  }
}
