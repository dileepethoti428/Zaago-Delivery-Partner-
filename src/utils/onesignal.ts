/**
 * OneSignal integration via Median JavaScript Bridge
 * External ID = user email
 */

import { supabase } from '@/integrations/supabase/client';

// Extended Median OneSignal interface with all methods
declare global {
  interface Window {
    median?: {
      onesignal: {
        getDeviceState: () => Promise<{
          isSubscribed: boolean;
          isPushDisabled: boolean;
          userId: string | null; // This is the player_id
          pushToken: string | null;
        }>;
        login: (externalId: string) => void;
        logout: () => void;
        requestPermission: () => Promise<boolean>;
      };
    };
  }
}

// Track states to prevent duplicate calls
let loginInProgress = false;
let registrationInProgress = false;

// LocalStorage keys for tracking push registration
const PUSH_REGISTERED_KEY = 'zaago_push_registered';
const PUSH_REGISTERED_EMAIL_KEY = 'zaago_push_registered_email';

/**
 * Check if running inside Median app
 */
export function isMedianApp(): boolean {
  return typeof window !== 'undefined' && typeof window.median !== 'undefined';
}

/**
 * Check if push is already registered for this email
 */
function isPushRegisteredForEmail(email: string): boolean {
  const registeredEmail = localStorage.getItem(PUSH_REGISTERED_EMAIL_KEY);
  return registeredEmail === email;
}

/**
 * Mark push as registered for an email
 */
function setPushRegisteredForEmail(email: string): void {
  localStorage.setItem(PUSH_REGISTERED_KEY, 'true');
  localStorage.setItem(PUSH_REGISTERED_EMAIL_KEY, email);
}

/**
 * Clear push registration (on logout)
 */
export function clearPushRegistration(): void {
  localStorage.removeItem(PUSH_REGISTERED_KEY);
  localStorage.removeItem(PUSH_REGISTERED_EMAIL_KEY);
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
    clearPushRegistration();
    console.log('[OneSignal] Logout success ✓');
  } catch (error) {
    console.error('[OneSignal] Logout failed:', error);
  }
}

/**
 * Register push notifications and store player_id
 * This function:
 * 1. Requests push notification permission
 * 2. Sets external_id (email) via login
 * 3. Gets player_id from device state
 * 4. Sends player_id + email to backend
 * 
 * Returns success status for toast display
 */
export async function registerPushNotifications(email: string): Promise<{
  success: boolean;
  playerId?: string;
}> {
  if (!isMedianApp()) {
    console.log('[OneSignal] Not in Median app, skipping push registration');
    return { success: false };
  }

  // Check if already registered for this email
  if (isPushRegisteredForEmail(email)) {
    console.log('[OneSignal] Push already registered for:', email);
    return { success: true };
  }

  // Prevent duplicate registration attempts
  if (registrationInProgress) {
    console.log('[OneSignal] Push registration already in progress, skipping');
    return { success: false };
  }

  registrationInProgress = true;

  try {
    console.log('[OneSignal] Starting push registration for:', email);

    // Wait for OneSignal to be ready
    const isReady = await waitForOneSignalReady();
    if (!isReady) {
      console.error('[OneSignal] Push registration aborted - not ready');
      return { success: false };
    }

    // Request push notification permission
    try {
      console.log('[OneSignal] Requesting push permission...');
      const granted = await window.median!.onesignal.requestPermission();
      console.log('[OneSignal] Permission granted:', granted);
      
      if (!granted) {
        console.log('[OneSignal] Permission denied, continuing without push');
        // Still continue to set external_id for targeting
      }
    } catch (permError) {
      console.log('[OneSignal] Permission request failed (may already be granted):', permError);
    }

    // Brief pause for permission to take effect
    await new Promise(resolve => setTimeout(resolve, 500));

    // Login with email as external_id (sets the external identifier)
    try {
      window.median!.onesignal.login(email);
      console.log('[OneSignal] External ID set:', email);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for login to process
    } catch (loginError) {
      console.error('[OneSignal] Failed to set external_id:', loginError);
    }

    // Get device state including player_id
    let playerId: string | null = null;
    try {
      const state = await window.median!.onesignal.getDeviceState();
      console.log('[OneSignal] Device state after registration:', state);
      playerId = state?.userId || null;
      
      if (!playerId) {
        console.warn('[OneSignal] No player_id available yet');
      }
    } catch (stateError) {
      console.error('[OneSignal] Failed to get device state:', stateError);
    }

    // Send player_id + email to backend (even if player_id is null, we record the email)
    if (playerId) {
      try {
        console.log('[OneSignal] Storing player_id:', playerId, 'for email:', email);
      const { error } = await supabase.functions.invoke('store-player-id', {
        body: {
          email,
          playerId,
          platform: detectPlatform(),
          app_type: 'agent',
        },
      });

        if (error) {
          console.error('[OneSignal] Failed to store player_id:', error);
        } else {
          console.log('[OneSignal] Player ID stored successfully ✓');
        }
      } catch (storeError) {
        console.error('[OneSignal] Error calling store-player-id:', storeError);
      }
    }

    // Mark as registered
    setPushRegisteredForEmail(email);
    console.log('[OneSignal] Push registration complete ✓');

    return {
      success: true,
      playerId: playerId || undefined,
    };

  } catch (error) {
    console.error('[OneSignal] Push registration failed:', error);
    return { success: false };
  } finally {
    registrationInProgress = false;
  }
}

/**
 * Check and register push if not already registered
 * Used on app resume
 */
export async function checkAndRegisterPush(email: string): Promise<void> {
  if (isPushRegisteredForEmail(email)) {
    return;
  }
  
  // Non-blocking registration attempt
  registerPushNotifications(email).catch(() => {});
}

/**
 * Detect platform (Android/iOS)
 */
function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  } else if (/android/.test(ua)) {
    return 'android';
  }
  return 'web';
}
