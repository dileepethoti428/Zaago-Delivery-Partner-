import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';

export function TestOrderUpdateButton() {
  const [loading, setLoading] = useState(false);

  const handleTestNotification = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login first');
        return;
      }

      // Get a test order or use mock data
      const { data: orders } = await supabase
        .from('orders')
        .select('id, user_id, status')
        .limit(1)
        .single();

      const testOrderId = orders?.id || crypto.randomUUID();
      const testStatus = 'confirmed';

      console.log('Sending test notification:', { 
        orderId: testOrderId, 
        status: testStatus, 
        userId: user.id 
      });

      const { data, error } = await supabase.functions.invoke('send-order-update-notification', {
        body: {
          orderId: testOrderId,
          status: testStatus,
          userId: user.id,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Failed to send notification: ' + error.message);
        return;
      }

      console.log('OneSignal response:', data);
      
      if (data.success) {
        toast.success('Test notification sent! Check your device.');
        toast.info(`Recipients: ${data.oneSignalResponse?.recipients || 0}`);
      } else {
        toast.error('Notification failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleTestNotification} 
      disabled={loading}
      variant="outline"
      className="gap-2"
    >
      <Bell className="h-4 w-4" />
      {loading ? 'Sending...' : 'Send Test Order Update'}
    </Button>
  );
}
