import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, CheckCircle, AlertTriangle, RotateCcw, Loader2 } from "lucide-react";

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
  const [lastSelectedMethod, setLastSelectedMethod] = useState<string | null>(null);

  const handlePaymentMethod = async (method: 'COD' | 'Online') => {
    setIsProcessing(true);
    setLastSelectedMethod(method);
    
    try {
      console.log('PaymentMethodDialog: Processing payment method:', method);
      
      // Close dialog first if no error state
      if (!error) {
        onOpenChange(false);
      }
      
      // Add small delay to ensure dialog closes smoothly before processing
      setTimeout(() => {
        onSuccess?.(method);
      }, 100);
      
    } catch (processingError) {
      console.error('Payment method selection error:', processingError);
      toast({
        title: "Payment Selection Failed",
        description: "Unable to process payment method. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    if (lastSelectedMethod && onRetry) {
      onRetry();
    } else if (lastSelectedMethod) {
      handlePaymentMethod(lastSelectedMethod as 'COD' | 'Online');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground text-center">
            {order.payment_status === 'completed' ? (
              <>
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                Order Already Delivered
              </>
            ) : error ? (
              <>
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-destructive" />
                Delivery Failed
              </>
            ) : (
              <>
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
                Order Delivered Successfully!
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-center">
            {order.payment_status === 'completed' ? (
              <span className="text-muted-foreground">This order has already been completed and delivered.</span>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              "Select payment method to complete the delivery"
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center space-y-2">
            {order.payment_status === 'completed' ? (
              /* Don't show customer details for already delivered orders */
              null
            ) : (
              <>
                <p className="text-foreground font-medium">
                  {order.customer_name}
                </p>
                <p className="text-lg font-bold text-primary">
                  ₹{order.total_amount}
                </p>
                {!error && (
                  <p className="text-sm text-muted-foreground">
                    Please select payment method to complete
                  </p>
                )}
              </>
            )}
          </div>

          {order.payment_status === 'completed' ? (
            /* Already Delivered State - Just show delivered message */
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-700 mb-1">
                  Product Already Delivered ✅
                </h3>
                <p className="text-sm text-muted-foreground">
                  This order has been successfully completed
                </p>
              </div>
            </div>
          ) : error ? (
            /* Error State - Show Retry Button */
            <div className="space-y-3">
              <Button
                onClick={handleRetry}
                disabled={isProcessing || !lastSelectedMethod}
                className="w-full h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-5 h-5 mr-2" />
                )}
                {isProcessing ? 'Retrying...' : 'Retry Delivery'}
              </Button>
              
              {lastSelectedMethod && (
                <p className="text-sm text-muted-foreground text-center">
                  Will retry with {lastSelectedMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}
                </p>
              )}
            </div>
          ) : (
            /* Normal State - Show Payment Options */
            <div className="space-y-3">
              {/* Always show both COD and Online options */}
              <Button
                onClick={() => handlePaymentMethod('COD')}
                disabled={isProcessing}
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Banknote className="w-5 h-5 mr-2" />
                )}
                {isProcessing ? 'Processing...' : 'Cash on Delivery (COD)'}
              </Button>
              
              <Button
                onClick={() => handlePaymentMethod('Online')}
                disabled={isProcessing}
                className="w-full h-12 bg-gradient-neon hover:shadow-neon"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-5 h-5 mr-2" />
                )}
                {isProcessing ? 'Processing...' : 'Online Payment'}
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="w-full"
          >
            {error ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};