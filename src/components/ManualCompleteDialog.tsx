import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, Package, MapPin, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query-config";

interface ManualCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderTotal: number;
  customerName: string;
  onSuccess: () => void;
}

export const ManualCompleteDialog = ({
  open,
  onOpenChange,
  orderId,
  orderTotal,
  customerName,
  onSuccess,
}: ManualCompleteDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'COD' | 'ONLINE' | null>(null);

  const handleComplete = async (paymentMethod: 'COD' | 'ONLINE') => {
    setIsProcessing(true);
    setSelectedMethod(paymentMethod);

    try {
      console.log('🚀 Manual completion started:', { orderId, paymentMethod });

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('📤 Invoking unified-complete-delivery function...');

      const { data, error } = await supabase.functions.invoke('unified-complete-delivery', {
        body: {
          order_id: orderId,
          payment_method: paymentMethod
        }
      });

      console.log('📥 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Manual completion edge function error:', error);
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data) {
        console.error('❌ No data returned from edge function');
        throw new Error('No response from server');
      }

      if (data.success === false) {
        console.error('❌ Manual completion failed:', data);
        throw new Error(data.error || 'Failed to complete delivery');
      }

      console.log('✅ Manual completion successful:', data);

      // Show success with payout info
      const payoutAmount = data.payout_amount || 30;
      const isAlreadyCompleted = data.already_completed || false;
      
      toast({
        title: isAlreadyCompleted ? "✅ Already Completed" : "✅ Delivery Completed!",
        description: `Order for ${customerName} ${isAlreadyCompleted ? 'was already marked' : 'marked'} as delivered. Payout: ₹${payoutAmount}`,
        duration: 5000,
      });

      // Invalidate queries to refresh from server
      await queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['delivery-history'] });

      onOpenChange(false);
      onSuccess();

    } catch (error) {
      console.error('❌ Manual completion error:', error);
      
      toast({
        title: "❌ Completion Failed",
        description: error instanceof Error ? error.message : 'Failed to complete delivery manually',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setSelectedMethod(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            <span>Mark as Delivered</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Summary Card */}
          <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-start space-x-3">
              <Package className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-semibold text-foreground">{customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Total</p>
                  <p className="text-lg font-bold text-foreground">₹{orderTotal}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground flex items-center">
              <Clock className="w-4 h-4 mr-2 text-primary" />
              Select Payment Method
            </p>
            
            <Button
              onClick={() => handleComplete('COD')}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              {isProcessing && selectedMethod === 'COD' ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <span className="text-2xl mr-2">💵</span>
              )}
              Cash on Delivery
            </Button>

            <Button
              onClick={() => handleComplete('ONLINE')}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              {isProcessing && selectedMethod === 'ONLINE' ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <span className="text-2xl mr-2">💳</span>
              )}
              Online Payment
            </Button>
          </div>

          {/* Info Banner */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>💡 Tip:</strong> Select the payment method customer used for this order
            </p>
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
