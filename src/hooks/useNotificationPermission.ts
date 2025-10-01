import { useState, useEffect } from 'react';

export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Register service worker and subscribe to push
        await registerPushSubscription();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const registerPushSubscription = async () => {
    try {
      if (!('serviceWorker' in navigator)) {
        console.error('Service Worker not supported');
        return;
      }

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      console.log('📱 Service Worker ready, registering push subscription');

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
        ),
      });

      setIsSubscribed(true);
      console.log('✅ Push subscription registered:', subscription);

      // Store subscription in localStorage AND database for backend use
      localStorage.setItem('pushSubscription', JSON.stringify(subscription));
      
      // Store in Supabase for backend edge functions to use
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email) {
        // Update delivery agent with push subscription
        const { error } = await supabase
          .from('delivery_agents')
          .update({ 
            push_subscription: subscription,
            updated_at: new Date().toISOString()
          })
          .eq('email', user.email);
        
        if (error) {
          console.error('Error storing push subscription in DB:', error);
        } else {
          console.log('✅ Push subscription stored in database');
        }
      }
    } catch (error) {
      console.error('Error registering push subscription:', error);
    }
  };

  return {
    permission,
    isSubscribed,
    requestPermission,
    hasPermission: permission === 'granted',
  };
};

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
