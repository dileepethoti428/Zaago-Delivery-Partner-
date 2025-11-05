import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    OneSignal: any;
  }
}

export function OneSignalInit() {
  useEffect(() => {
    // Guard: Only run in browser environment
    if (typeof window === 'undefined') return;

    // Load OneSignal SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      // Initialize OneSignal with error handling
      window.OneSignal = window.OneSignal || [];
      window.OneSignal.push(async function() {
        try {
          await window.OneSignal.init({
            appId: import.meta.env.VITE_ONESIGNAL_APP_ID || 'YOUR_ONESIGNAL_APP_ID',
            notifyButton: {
              enable: false,
            },
            allowLocalhostAsSecureOrigin: true,
          });

          // Set external user ID when user is authenticated
          const { data: { user } } = await supabase.auth.getUser();
          if (user && window.OneSignal.login) {
            console.log('Setting OneSignal user login:', user.id);
            await window.OneSignal.login(user.id);
            
            // Get player ID and store it in delivery_agents table
            if (window.OneSignal.User?.PushSubscription?.id) {
              const playerId = await window.OneSignal.User.PushSubscription.id;
              console.log('OneSignal player ID:', playerId);
              
              if (playerId) {
                // Update delivery_agents with OneSignal player ID
                await supabase
                  .from('delivery_agents')
                  .update({ onesignal_player_id: playerId })
                  .eq('id', user.id);
              }
            }
          }

          // Listen for foreground notifications
          if (window.OneSignal.on) {
            window.OneSignal.on('notificationDisplay', function(event: any) {
              console.log('OneSignal notification displayed:', event);
            });
          }
        } catch (error) {
          console.error('OneSignal initialization error:', error);
          // Silently fail - don't show error to user
        }
      });
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'SIGNED_IN' && session?.user && window.OneSignal?.login) {
          console.log('User signed in, setting OneSignal login');
          await window.OneSignal.login(session.user.id);
          
          if (window.OneSignal.User?.PushSubscription?.id) {
            const playerId = await window.OneSignal.User.PushSubscription.id;
            if (playerId) {
              await supabase
                .from('delivery_agents')
                .update({ onesignal_player_id: playerId })
                .eq('id', session.user.id);
            }
          }
        } else if (event === 'SIGNED_OUT' && window.OneSignal?.logout) {
          console.log('User signed out, logging out from OneSignal');
          await window.OneSignal.logout();
        }
      } catch (error) {
        console.error('OneSignal auth state change error:', error);
        // Silently fail - don't show error to user
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
