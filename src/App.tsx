import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

useEffect(() => {
  const handler = async (event: any) => {
    const fcmToken = event.detail;
    console.log("📲 FCM TOKEN FROM NATIVE:", fcmToken);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      console.error("❌ Supabase access token missing");
      return;
    }

    const { error } = await supabase.functions.invoke("store-fcm-token", {
      body: { fcmToken },
    });

    if (error) {
      console.error("❌ Failed to store FCM token:", error);
    } else {
      console.log("✅ FCM token stored in database");
    }
  };

  window.addEventListener("FCM_TOKEN", handler);
  return () => window.removeEventListener("FCM_TOKEN", handler);
}, []);
