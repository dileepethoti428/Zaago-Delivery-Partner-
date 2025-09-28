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
  const [showSuccess, setShowSuccess] = useState(false);

  const handlePaymentMethod = async (method: 'COD' | 'Online') => {
    setIsProcessing(true);
    setLastSelectedMethod(method);
    
    try {
      console.log('🎯 PaymentMethodDialog: Processing payment method:', method);
      console.log('🎯 onSuccess callback exists:', !!onSuccess);
      
      // Don't close dialog yet - keep it open for processing and success states
      if (onSuccess) {
        // Call the success handler and wait for it
        await new Promise((resolve, reject) => {
          const originalOnSuccess = onSuccess;
          const wrappedOnSuccess = async (paymentMethod: string) => {
            try {
              await originalOnSuccess(paymentMethod);
              setShowSuccess(true);
              
              // Show success state for 2 seconds then close
              setTimeout(() => {
                setShowSuccess(false);
                setIsProcessing(false);
                onOpenChange(false);
                
                // Show success toast
                toast({
                  title: "✅ Product Delivered Successfully!",
                  description: `Payment method: ${paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}`,
                  variant: "default"
                });
              }, 2000);
              
              resolve(undefined);
            } catch (error) {
              reject(error);
            }
          };
          
          wrappedOnSuccess(method);
        });
      }
      
    } catch (processingError) {
      console.error('❌ Payment method processing error:', processingError);
      setIsProcessing(false);
      toast({
        title: "Delivery Failed",
        description: "Unable to complete delivery. Please try again.",
        variant: "destructive"
      });
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
            ) : showSuccess ? (
              <>
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500 animate-pulse" />
                Product Delivered Successfully! ✅
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-primary animate-spin" />
                Processing Delivery...
              </>
            ) : error ? (
              <>
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-destructive" />
                Delivery Failed
              </>
            ) : (
              "Select Payment Method"
            )}
          </DialogTitle>
          <DialogDescription className="text-center">
            {order.payment_status === 'completed' ? (
              <span className="text-muted-foreground">This order has already been completed and delivered.</span>
            ) : showSuccess ? (
              <span className="text-green-600 font-medium">
                Payment confirmed • Order completed
              </span>
            ) : isProcessing ? (
              <span className="text-muted-foreground">
                Please wait while we complete the delivery...
              </span>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              "Choose how the customer paid for this order"
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
          ) : showSuccess ? (
            /* Success State - Show completion animation */
            <div className="text-center space-y-4 py-4">
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-700 mb-2">
                  🎉 Delivery Completed!
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Customer: {order.customer_name}
                </p>
                <p className="text-lg font-semibold text-primary">
                  ₹{order.total_amount}
                </p>
                {lastSelectedMethod && (
                  <p className="text-sm text-green-600 mt-2 font-medium">
                    Payment: {lastSelectedMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}
                  </p>
                )}
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
            <div className="space-y-4">
              {!isProcessing && !showSuccess && (
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
                      disabled={isProcessing || showSuccess}
                      className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                    >
                      <Banknote className="w-5 h-5 mr-2" />
                      Cash on Delivery (COD)
                    </Button>
                    
                    <Button
                      onClick={() => handlePaymentMethod('Online')}
                      disabled={isProcessing || showSuccess}
                      className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      Online Payment
                    </Button>
                  </div>
                </>
              )}
              
              {isProcessing && !showSuccess && (
                <div className="text-center space-y-4 py-8">
                  <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                  <div>
                    <p className="text-lg font-medium text-foreground mb-2">
                      Completing delivery...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Payment method: {lastSelectedMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!showSuccess && !isProcessing && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing || showSuccess}
              className="w-full"
            >
              {error ? 'Close' : 'Cancel'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};