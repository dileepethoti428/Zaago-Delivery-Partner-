import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, Loader2 } from "lucide-react";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    order_id: string;
    customer_name: string;
    total_amount: number;
    payment_status?: string;
  };
  onSuccess?: (paymentMethod: string) => Promise<void> | void;
  selectionOnly?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const PaymentMethodDialog = ({ 
  open, 
  onOpenChange, 
  order, 
  onSuccess, 
  selectionOnly = true,
  error = null,
  onRetry
}: PaymentMethodDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentMethod = async (method: 'COD' | 'Online') => {
    console.log('🎯 Payment method selected:', method);
    if (!onSuccess) {
      console.error('❌ No onSuccess function provided');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      console.log('🚀 Calling onSuccess with payment method:', method);
      const result = await onSuccess(method);
      console.log('✅ onSuccess completed:', result);
      
      // Don't show toast here - let the main component handle it
      // Close dialog after successful completion
      onOpenChange(false);
      
    } catch (error) {
      console.error('❌ Delivery completion failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error details:', errorMessage);
      toast({
        title: "Delivery Failed",
        description: `Error: ${errorMessage}`,
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
            {isProcessing ? "Processing Delivery..." : "Select Payment Method"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isProcessing 
              ? "Please wait while we complete the delivery..." 
              : "Choose how the customer paid for this order"
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {isProcessing ? (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
              <div>
                <p className="text-lg font-medium text-foreground mb-2">
                  Completing delivery...
                </p>
                <p className="text-sm text-muted-foreground">
                  Updating your delivery status
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <p className="text-foreground font-medium">
                  {order.customer_name}
                </p>
                <p className="text-2xl font-bold text-primary">
                  ₹{order.total_amount}
                </p>
              </div>
              
              <div className="space-y-3">
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
                  className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};