import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  onSuccess?: () => void;
}

export const PaymentMethodDialog = ({ open, onOpenChange, order, onSuccess }: PaymentMethodDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentMethod = async (method: 'COD' | 'Online') => {
    setIsProcessing(true);
    
    try {
      // Get current agent
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "Please log in to continue",
          variant: "destructive"
        });
        return;
      }

      // Get agent details
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

      // Update order status to delivered
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          payment_status: method === 'COD' ? 'COD' : 'Paid',
          delivered: true,
          delivered_at: new Date().toISOString()
        })
        .eq('id', order.order_id);

      if (orderError) {
        throw orderError;
      }

      // Create delivery history record
      const { error: historyError } = await supabase
        .from('delivery_history')
        .insert({
          order_id: order.order_id,
          agent_id: agent.id,
          customer_name: order.customer_name,
          total_amount: order.total_amount,
          payment_status: method === 'COD' ? 'COD' : 'Paid',
          payment_method: method,
          delivery_date: new Date().toISOString().split('T')[0],
          completed_at: new Date().toISOString(),
          delivery_address: { address: 'Customer Address' }, // Placeholder
          items: { items: [] } // Placeholder
        });

      if (historyError) {
        throw historyError;
      }

      // Calculate payout using new system
      const distance = 2.0; // Default distance - should be calculated from actual route
      const { data: payoutData, error: payoutError } = await supabase.rpc('calculate_delivery_payout', {
        distance_km: distance,
        delivery_time: new Date().toISOString(),
        agent_id_param: agent?.id || null
      });

      let totalEarning = 15; // Default base pay
      
      if (payoutError) {
        console.error('Payout calculation error:', payoutError);
        // Fallback to base pay
        const { error: earningsError } = await supabase
          .from('earnings')
          .insert({
            agent_id: agent?.id,
            order_id: order.order_id,
            amount: totalEarning,
            status: 'completed'
          });

        if (earningsError) {
          throw earningsError;
        }
      } else {
        // Process payout with breakdown
        const payout = payoutData as any; // Type assertion for JSON response
        totalEarning = payout?.total_payout || 15;
        
        const { error: processError } = await supabase.rpc('process_delivery_payout', {
          p_agent_id: agent?.id,
          p_order_id: order.order_id,
          p_distance_km: distance,
          p_delivery_time: new Date().toISOString()
        });

        if (processError) {
          console.error('Payout processing error:', processError);
          // Fallback to manual earnings insert
          const { error: earningsError } = await supabase
            .from('earnings')
            .insert({
              agent_id: agent?.id,
              order_id: order.order_id,
              amount: totalEarning,
              status: 'completed'
            });

          if (earningsError) {
            throw earningsError;
          }
        }
      }

      // Update delivery agent stats
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

      // Add order tracking record
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
        description: `Payment via ${method} confirmed. You earned ₹${totalEarning.toFixed(2)}${payoutData ? ` (Base: ₹${(payoutData as any).base_pay}, Distance: ₹${(payoutData as any).distance_pay}, Bonus: ₹${(payoutData as any).peak_bonus})` : ''}`,
      });

      onOpenChange(false);
      onSuccess?.();
      
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
            {order.payment_status === 'paid' || order.payment_status === 'prepaid' ? (
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