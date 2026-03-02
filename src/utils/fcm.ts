import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

// Guard to prevent duplicate listener registration
let fcmInitialized = false;

/**
 * Register FCM token and save to database
 * Safe to call multiple times - will only initialize once
 */
export async function registerFCMToken() {
  // Only run on native platforms (iOS/Android) — PushNotifications plugin unavailable on web
  if (!Capacitor.isNativePlatform()) {
    console.log('[FCM] Skipping — not a native platform');
    return;
  }

  // Prevent duplicate listeners
  if (fcmInitialized) return;
  fcmInitialized = true;

  // Clean any existing listeners first
  await PushNotifications.removeAllListeners();

  // 1. Request permission
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") {
    console.warn("❌ FCM permission not granted");
    fcmInitialized = false; // Allow retry on permission denied
    return;
  }

  // 2. Register with FCM
  await PushNotifications.register();

  // 3. Listen for token
  PushNotifications.addListener("registration", async (token) => {
    console.log("✅ FCM TOKEN:", token.value);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      console.warn("❌ No logged in user for token save");
      return;
    }

    const { error } = await supabase
      .from("delivery_agents")
      .update({
        fcm_token: token.value,
        updated_at: new Date().toISOString(),
      })
      .eq("email", user.email);

    if (error) {
      console.error("❌ Failed to save FCM token:", error);
    } else {
      console.log("✅ FCM token saved");
    }
  });

  // 4. Handle registration errors
  PushNotifications.addListener("registrationError", (err) => {
    console.error("❌ FCM registration error:", err);
  });
}

/**
 * Reset FCM initialization state (call on logout)
 */
export function resetFCMState() {
  fcmInitialized = false;
}
