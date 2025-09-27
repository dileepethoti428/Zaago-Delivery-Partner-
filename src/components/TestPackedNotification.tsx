import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAudioNotification } from '@/hooks/useAudioNotification';

interface TestPackedNotificationProps {
  onClose?: () => void;
}

const TestPackedNotification: React.FC<TestPackedNotificationProps> = ({ onClose }) => {
  const [orderId, setOrderId] = useState('550e8400-e29b-41d4-a716-446655440000');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { playNotificationSound, testRingtone } = useAudioNotification();

  // Direct audio test that works independently of backend
  const handleDirectAudioTest = async () => {
    try {
      console.log('🔊 Testing direct audio playback...');
      
      // Test the ringtone directly
      testRingtone();
      
      // Also test notification sound
      await playNotificationSound();
      
      toast({
        title: "🔊 Direct Audio Test",
        description: "Audio should play immediately if working correctly",
      });
    } catch (error) {
      console.error('❌ Direct audio test failed:', error);
      toast({
        title: "Audio Test Failed",
        description: error instanceof Error ? error.message : 'Audio system not working',
        variant: "destructive",
      });
    }
  };

  const handleMarkAsPacked = async () => {
    if (!orderId.trim()) {
      toast({
        title: "Error",
        description: "Please enter an order ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🧪 Testing mark-order-as-packed for order:', orderId);
      
      const { data, error } = await supabase.functions.invoke('mark-order-as-packed', {
        body: {
          order_id: orderId,
          marked_by: 'test-admin@zaago.com'
        }
      });

      if (error) {
        console.error('❌ Error marking order as packed:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to mark order as packed",
          variant: "destructive"
        });
      } else {
        console.log('✅ Successfully marked order as packed:', data);
        toast({
          title: "Success! 🎉",
          description: `Order ${orderId} marked as packed. Audio should play from real-time broadcast!`,
          duration: 5000
        });
        
        // Backup audio trigger after successful backend call
        setTimeout(() => {
          console.log('🔊 Playing backup audio after backend success');
          playNotificationSound();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Exception marking order as packed:', error);
      toast({
        title: "Error",
        description: "Failed to mark order as packed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Audio Notification Test
        </CardTitle>
        <CardDescription>
          Test audio notifications and packed order system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="orderId">Order ID</Label>
          <Input
            id="orderId"
            placeholder="Enter order ID to mark as packed"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
        </div>
        
        <div className="space-y-2">
          <Button 
            onClick={handleDirectAudioTest}
            variant="outline"
            className="w-full"
          >
            🔊 Test Direct Audio
          </Button>
          <p className="text-xs text-muted-foreground">
            Tests audio system directly - should play immediately
          </p>
        </div>
        
        <div className="space-y-2">
          <Button 
            onClick={handleMarkAsPacked}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? '⏳ Processing...' : '📦 Mark as Packed & Test Flow'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tests: Backend → Real-time → Audio notification
          </p>
        </div>
        
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        )}
        
        <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
          <p className="font-medium">What this tests:</p>
          <p>• Direct audio playback (browser capability)</p>
          <p>• Backend notification system</p>
          <p>• Real-time broadcast to agents</p>
          <p>• Audio trigger from real-time events</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestPackedNotification;