import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    OneSignal: any;
  }
}

export function OneSignalInit() {
  useEffect(() => {
    // Load OneSignal SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      // Initialize OneSignal
      window.OneSignal = window.OneSignal || [];
      window.OneSignal.push(async function() {
        await window.OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID || 'YOUR_ONESIGNAL_APP_ID',
          notifyButton: {
            enable: false,
          },
          allowLocalhostAsSecureOrigin: true,
        });

        // Set external user ID when user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('Setting OneSignal external user ID:', user.id);
          await window.OneSignal.setExternalUserId(user.id);
          
          // Get player ID and store it in delivery_agents table
          const playerId = await window.OneSignal.getUserId();
          console.log('OneSignal player ID:', playerId);
          
          if (playerId) {
            // Update delivery_agents with OneSignal player ID
            await supabase
              .from('delivery_agents')
              .update({ onesignal_player_id: playerId })
              .eq('id', user.id);
          }
        }

        // Listen for foreground notifications
        window.OneSignal.on('notificationDisplay', function(event: any) {
          console.log('OneSignal notification displayed:', event);
        });
      });
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && window.OneSignal) {
        console.log('User signed in, setting OneSignal external user ID');
        await window.OneSignal.setExternalUserId(session.user.id);
        
        const playerId = await window.OneSignal.getUserId();
        if (playerId) {
          await supabase
            .from('delivery_agents')
            .update({ onesignal_player_id: playerId })
            .eq('id', session.user.id);
        }
      } else if (event === 'SIGNED_OUT' && window.OneSignal) {
        console.log('User signed out, removing OneSignal external user ID');
        await window.OneSignal.removeExternalUserId();
      }
    });

    return () => {
      subscription.unsubscribe();
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return null;
}
