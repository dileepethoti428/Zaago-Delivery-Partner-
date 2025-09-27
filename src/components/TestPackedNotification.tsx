import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TestPackedNotificationProps {
  onClose?: () => void;
}

const TestPackedNotification: React.FC<TestPackedNotificationProps> = ({ onClose }) => {
  const [orderId, setOrderId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
          description: `Order ${orderId} marked as packed. Agents should receive immediate notifications!`,
          duration: 5000
        });
        setOrderId('');
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
          🧪 Test Packed Notification
        </CardTitle>
        <CardDescription>
          Test the immediate notification system for packed orders
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
        
        <div className="flex gap-2">
          <Button 
            onClick={handleMarkAsPacked}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? '⏳' : '📦'} Mark as Packed
          </Button>
          
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• This will mark the order as "packed" status</p>
          <p>• All active delivery agents will receive immediate notifications</p>
          <p>• High-volume ringtones will play automatically</p>
          <p>• Both database and broadcast notifications will be sent</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestPackedNotification;