import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2 } from "lucide-react";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const handleComplete = async (paymentMethod: 'COD' | 'ONLINE') => {
    setIsProcessing(true);

    try {
      console.log('🚀 Manual completion started:', { orderId, paymentMethod });

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('📤 Invoking manual-complete-delivery function...');

      const { data, error } = await supabase.functions.invoke('manual-complete-delivery', {
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

      // Check the data response structure
      if (!data) {
        console.error('❌ No data returned from edge function');
        throw new Error('No response from server');
      }

      if (data.success === false) {
        console.error('❌ Manual completion failed:', data);
        throw new Error(data.error || data.details?.error || 'Failed to complete delivery');
      }

      console.log('✅ Manual completion successful:', data);

      toast({
        title: "✅ Delivery Completed!",
        description: `Order for ${customerName} marked as delivered via ${paymentMethod}`,
      });

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
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-semibold text-foreground">{customerName}</p>
            <p className="text-sm text-muted-foreground mt-2">Order Total</p>
            <p className="font-semibold text-foreground">₹{orderTotal}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Select Payment Method:</p>
            
            <Button
              onClick={() => handleComplete('COD')}
              disabled={isProcessing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              size="lg"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Cash on Delivery (COD)
            </Button>

            <Button
              onClick={() => handleComplete('ONLINE')}
              disabled={isProcessing}
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              size="lg"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Online Payment
            </Button>
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
