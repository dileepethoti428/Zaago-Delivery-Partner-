import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    order_id: string;
    customer_name: string;
    total_amount: number;
    payment_status?: string;
  };
  onSuccess?: (paymentMethod: string) => void;
  selectionOnly?: boolean; // New prop for QR flow
}

export const PaymentMethodDialog = ({ open, onOpenChange, order, onSuccess, selectionOnly = false }: PaymentMethodDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentMethod = async (method: 'COD' | 'Online') => {
    setIsProcessing(true);
    
    try {
      // If in selection-only mode (QR flow), just return the selection
      if (selectionOnly) {
        onOpenChange(false);
        onSuccess?.(method);
        return;
      }

      // Normal flow - handle database operations for non-QR deliveries
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "Please log in to continue",
          variant: "destructive"
        });
        return;
      }

      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .single();

      if (!agent) {
        toast({
          title: "Agent Not Found",
          description: "Unable to find active agent profile",
          variant: "destructive"
        });
        return;
      }

      // Map to valid database payment status values
      const validPaymentStatus = method === 'COD' ? 'paid_cod' : 'paid_online';

      // Calculate payout first
      const distance = 2.0;
      let totalEarning = 15; // Default base pay

      const { data: payoutData, error: payoutError } = await supabase.rpc('calculate_delivery_payout', {
        distance_km: distance,
        delivery_time: new Date().toISOString(),
        agent_id_param: agent?.id || null
      });

      if (!payoutError && payoutData) {
        const payout = payoutData as any;
        totalEarning = payout?.total_payout || 15;
      }

      // Update order with valid payment status values
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          payment_status: validPaymentStatus,
          delivered: true,
          delivered_at: new Date().toISOString()
        })
        .eq('id', order.order_id);

      if (orderError) {
        throw orderError;
      }

      // Create delivery history record with valid payment status and distance
      const { error: historyError } = await supabase
        .from('delivery_history')
        .insert({
          order_id: order.order_id,
          agent_id: agent.id,
          customer_name: order.customer_name,
          total_amount: order.total_amount,
          payment_status: validPaymentStatus,
          payment_method: method,
          delivery_date: new Date().toISOString().split('T')[0],
          completed_at: new Date().toISOString(),
          delivery_address: { address: 'Customer Address' },
          items: { items: [] },
          distance_traveled: distance,
          delivery_payout: totalEarning
        });

      if (historyError) {
        throw historyError;
      }

      // Create earnings record
      const { error: earningsError } = await supabase
        .from('earnings')
        .insert({
          agent_id: agent?.id,
          order_id: order.order_id,
          amount: totalEarning,
          status: 'completed', // Using valid status
          distance_km: distance,
          payment_method: method === 'COD' ? 'COD' : 'Online',
          description: `Delivery completed - Order ${order.order_id.substring(0, 8)}`
        });

      if (earningsError) {
        console.error('Earnings creation error:', earningsError);
      }

      // Update agent stats properly
      const { data: currentAgent } = await supabase
        .from('delivery_agents')
        .select('total_deliveries, deliveries_today, total_earnings')
        .eq('id', agent.id)
        .maybeSingle();

      const { error: agentUpdateError } = await supabase
        .from('delivery_agents')
        .update({
          total_deliveries: (currentAgent?.total_deliveries || 0) + 1,
          deliveries_today: (currentAgent?.deliveries_today || 0) + 1,
          total_earnings: (currentAgent?.total_earnings || 0) + totalEarning,
          last_delivery_at: new Date().toISOString()
        })
        .eq('id', agent.id);

      if (agentUpdateError) {
        console.error('Agent update error:', agentUpdateError);
      }

      await supabase
        .from('order_tracking')
        .insert({
          order_id: order.order_id,
          status: 'delivered',
          notes: `Order delivered successfully. Payment: ${method}`,
          created_by: user.id
        });

      toast({
        title: "Order Completed!",
        description: `Payment via ${method} confirmed. You earned ₹${totalEarning.toFixed(2)}`,
      });

      onOpenChange(false);
      onSuccess?.(method);
      
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({
        title: "Processing Failed",
        description: "Unable to complete the order. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
            Order Delivered Successfully!
          </DialogTitle>
          <DialogDescription className="text-center">
            Select payment method to complete the delivery
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-foreground font-medium">
              {order.customer_name}
            </p>
            <p className="text-lg font-bold text-primary">
              ₹{order.total_amount}
            </p>
            <p className="text-sm text-muted-foreground">
              Please select payment method to complete
            </p>
          </div>

          <div className="space-y-3">
            {/* Show only Online option if prepaid */}
            {order.payment_status === 'paid' || order.payment_status === 'paid_online' ? (
              <Button
                onClick={() => handlePaymentMethod('Online')}
                disabled={isProcessing}
                className="w-full h-12 bg-gradient-neon hover:shadow-neon"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Online Payment (Already Paid)
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => handlePaymentMethod('COD')}
                  disabled={isProcessing}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                >
                  <Banknote className="w-5 h-5 mr-2" />
                  Cash on Delivery (COD)
                </Button>
                
                <Button
                  onClick={() => handlePaymentMethod('Online')}
                  disabled={isProcessing}
                  className="w-full h-12 bg-gradient-neon hover:shadow-neon"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Online Payment (Razorpay)
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};