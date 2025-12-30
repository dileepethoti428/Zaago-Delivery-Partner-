/**
 * OneSignal integration via Median JavaScript Bridge
 * External ID = user email
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
 * Poll for window.median.onesignal to be available
 * Shows countdown toast during polling
 */
async function pollForOneSignalBridge(
  showDebugToasts: boolean = false
): Promise<boolean> {
  const maxAttempts = 60; // 30 seconds total
  const intervalMs = 500;
  
  console.log('[OneSignal] Starting bridge polling...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check if onesignal bridge is available
    if (window.median?.onesignal) {
      console.log('[OneSignal] Bridge ready after', attempt, 'attempts');
      if (showDebugToasts) {
        toast({
          title: '✅ OneSignal ready!',
          description: 'Median bridge initialized',
        });
      }
      return true;
    }
    
    // Calculate remaining time
    const remainingSeconds = Math.ceil((maxAttempts - attempt) * intervalMs / 1000);
    
    // Show countdown every 2 seconds (every 4 attempts)
    if (showDebugToasts && attempt % 4 === 1) {
      toast({
        title: `⏳ Polling OneSignal... ${remainingSeconds}s`,
        description: `Attempt ${attempt}/${maxAttempts}`,
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  // Timeout reached
  console.error('[OneSignal] Bridge polling timeout after 30 seconds');
  if (showDebugToasts) {
    toast({
      title: '❌ Timeout: OneSignal not ready',
      description: 'Install latest APK from Median with OneSignal enabled',
      variant: 'destructive',
    });
  }
  
  return false;
}

/**
 * Poll for device subscription until userId is available
 * This is called AFTER permission is granted
 */
async function pollForDeviceSubscription(
  showDebugToasts: boolean = false
): Promise<{ userId: string | null; isSubscribed: boolean }> {
  const maxAttempts = 20; // 20 seconds total
  const intervalMs = 1000;
  
  console.log('[OneSignal] Starting device subscription polling...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const remainingSeconds = maxAttempts - attempt + 1;
    
    // Show countdown every 3 seconds
    if (showDebugToasts && attempt % 3 === 1) {
      toast({
        title: `⏳ Waiting device state... ${remainingSeconds}s left`,
        description: `Attempt ${attempt}/${maxAttempts}`,
      });
    }
    
    try {
      const state = await window.median!.onesignal.getDeviceState();
      console.log(`[OneSignal] Device state poll ${attempt}/${maxAttempts}:`, state);
      
      if (state?.userId) {
        console.log('[OneSignal] Device subscribed! userId:', state.userId);
        return { userId: state.userId, isSubscribed: true };
      }
    } catch (e) {
      console.log(`[OneSignal] Device state error (attempt ${attempt}):`, e);
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  // Timeout
  console.error('[OneSignal] Device subscription polling timeout');
  if (showDebugToasts) {
    toast({
      title: '❌ OneSignal not subscribed',
      description: 'Check phone notification settings',
      variant: 'destructive',
    });
  }
  
  return { userId: null, isSubscribed: false };
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
    
    // Check if OneSignal bridge is available
    if (!window.median?.onesignal) {
      console.error('[OneSignal] Login aborted - bridge not available');
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
export async function registerPushNotifications(
  email: string,
  showDebugToasts: boolean = false
): Promise<{
  success: boolean;
  playerId?: string;
}> {
  // Step 0: Check if in Median app
  if (!window.median) {
    console.log('[OneSignal] Not in Median app, skipping push registration');
    if (showDebugToasts) {
      toast({
        title: '❌ Not in Median app',
        description: 'Push only works in the native APK',
        variant: 'destructive',
      });
    }
    return { success: false };
  }

  // Step 1: Check if onesignal is immediately available or poll for it
  if (!window.median.onesignal) {
    console.log('[OneSignal] Bridge not immediately available, starting polling...');
    if (showDebugToasts) {
      toast({
        title: '⚠️ OneSignal not ready',
        description: 'Starting polling...',
      });
    }
    
    // Poll for up to 30 seconds
    const bridgeReady = await pollForOneSignalBridge(showDebugToasts);
    
    if (!bridgeReady) {
      console.error('[OneSignal] Bridge never became available');
      if (showDebugToasts) {
        toast({
          title: '❌ Update Median APK',
          description: 'OneSignal bridge not found after 30s',
          variant: 'destructive',
        });
      }
      return { success: false };
    }
  } else {
    if (showDebugToasts) {
      toast({
        title: '✅ Median app detected',
        description: 'OneSignal bridge available',
      });
    }
  }

  // Check if already registered for this email
  if (isPushRegisteredForEmail(email)) {
    console.log('[OneSignal] Push already registered for:', email);
    if (showDebugToasts) {
      toast({
        title: '✅ Already registered',
        description: `Push already set up for ${email}`,
      });
    }
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

    // Step 2: Request push notification permission FIRST
    if (showDebugToasts) {
      toast({
        title: '🔐 Requesting push permission...',
        description: 'Please allow notifications when prompted',
      });
    }

    let permissionGranted = false;
    try {
      console.log('[OneSignal] Requesting push permission...');
      permissionGranted = await window.median!.onesignal.requestPermission();
      console.log('[OneSignal] Permission result:', permissionGranted);
    } catch (permError) {
      console.log('[OneSignal] Permission request error (may already be granted):', permError);
      // Assume granted if error (might already be granted)
      permissionGranted = true;
    }

    // Wait 3 seconds for permission to take effect
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (showDebugToasts) {
      if (permissionGranted) {
        toast({
          title: '✅ Permission granted',
          description: 'Push notifications allowed',
        });
      } else {
        toast({
          title: '❌ Push permission required',
          description: 'Enable in app settings to receive notifications',
          variant: 'destructive',
        });
        return { success: false };
      }
    }

    // If permission explicitly denied, stop
    if (!permissionGranted) {
      console.error('[OneSignal] Permission denied by user');
      return { success: false };
    }

    // Step 3: Poll for device subscription (up to 20s)
    const subscriptionResult = await pollForDeviceSubscription(showDebugToasts);

    if (!subscriptionResult.userId) {
      console.error('[OneSignal] Device never became subscribed');
      if (showDebugToasts) {
        toast({
          title: '❌ OneSignal not subscribed',
          description: 'Check phone notification settings',
          variant: 'destructive',
        });
      }
      return { success: false };
    }

    const playerId = subscriptionResult.userId;

    if (showDebugToasts) {
      toast({
        title: '✅ Device subscribed! Player ID: ' + playerId.substring(0, 8) + '...',
        description: 'Ready to receive push notifications',
      });
    }

    // Step 4: Login with email as external_id
    try {
      window.median!.onesignal.login(email);
      console.log('[OneSignal] External ID set:', email);
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for login to process
    } catch (loginError) {
      console.error('[OneSignal] Failed to set external_id:', loginError);
    }

    // Step 4: Send player_id + email to backend
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
          if (showDebugToasts) {
            toast({
              title: '❌ Failed to store in backend',
              description: error.message || 'Edge function error',
              variant: 'destructive',
            });
          }
        } else {
          console.log('[OneSignal] Player ID stored successfully ✓');
          if (showDebugToasts) {
            toast({
              title: '✅ Stored in backend',
              description: 'Player ID saved to database',
            });
          }
        }
      } catch (storeError) {
        console.error('[OneSignal] Error calling store-player-id:', storeError);
        if (showDebugToasts) {
          toast({
            title: '❌ Backend call failed',
            description: String(storeError),
            variant: 'destructive',
          });
        }
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
    if (showDebugToasts) {
      toast({
        title: '❌ Registration failed',
        description: String(error),
        variant: 'destructive',
      });
    }
    return { success: false };
  } finally {
    registrationInProgress = false;
  }
}

/**
 * Force re-register push notifications (clears localStorage + retries with debug toasts)
 */
export async function forceReRegisterPush(email: string): Promise<{ success: boolean; playerId?: string }> {
  // Clear localStorage flags
  clearPushRegistration();
  
  toast({
    title: '🔄 Re-registering push...',
    description: 'Clearing cache and retrying',
  });
  
  // Call registration with debug toasts enabled
  return registerPushNotifications(email, true);
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
