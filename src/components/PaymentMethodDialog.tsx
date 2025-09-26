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

export const PaymentMethodDialog = ({ open, onOpenChange, order, onSuccess, selectionOnly = true }: PaymentMethodDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentMethod = async (method: 'COD' | 'Online') => {
    setIsProcessing(true);
    
    try {
      console.log('PaymentMethodDialog: Processing payment method:', method);
      console.log('PaymentMethodDialog: Selection only mode:', selectionOnly);
      
      // Always run in selection-only mode - just return the method selection
      // The actual delivery completion happens in the parent component
      onOpenChange(false);
      onSuccess?.(method);
      
    } catch (error) {
      console.error('Payment method selection error:', error);
      toast({
        title: "Selection Failed",
        description: "Unable to select payment method. Please try again.",
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