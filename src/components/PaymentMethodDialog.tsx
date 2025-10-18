import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    order_id: string;
    customer_name: string;
    total_amount: number;
    payment_status?: string;
  };
  onSuccess?: (paymentMethod: string) => Promise<{payout_amount?: number} | void> | void;
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
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRazorpayQR, setShowRazorpayQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [razorpayQrId, setRazorpayQrId] = useState<string>('');
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Reset states when dialog closes
  useEffect(() => {
    if (!open) {
      setQrCodeUrl(null);
      setShowRazorpayQR(false);
      setIsGeneratingQR(false);
      setRazorpayQrId('');
      setIsCheckingPayment(false);
    }
  }, [open]);

  // Poll for payment completion
  useEffect(() => {
    if (!razorpayQrId || !showRazorpayQR || isCheckingPayment) return;

    const checkPaymentStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-payment-status', {
          body: { qr_id: razorpayQrId }
        });

        if (error) throw error;

        if (data?.isPaid) {
          setIsCheckingPayment(true);
          toast({
            title: "Payment Received!",
            description: "Completing order automatically...",
          });
          await handlePaymentComplete();
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };

    // Check immediately
    checkPaymentStatus();

    // Then poll every 3 seconds
    const interval = setInterval(checkPaymentStatus, 3000);

    return () => clearInterval(interval);
  }, [razorpayQrId, showRazorpayQR, isCheckingPayment]);

  const handlePaymentMethod = async (method: 'COD' | 'Online') => {
    console.log('🎯 Payment method selected:', method);
    
    // Check if order is already delivered
    if (order.payment_status === 'paid_cod' || order.payment_status === 'paid_online') {
      toast({
        title: "Already Delivered",
        description: "This order has already been completed and delivered",
        variant: "destructive"
      });
      onOpenChange(false);
      return;
    }

    // If Online Payment selected, generate and show Razorpay QR
    if (method === 'Online') {
      setIsGeneratingQR(true);
      try {
        console.log('🔐 Generating dynamic Razorpay QR code...');
        const { data, error } = await supabase.functions.invoke('generate-payment-qr', {
          body: {
            order_id: order.order_id,
            amount: order.total_amount,
            customer_name: order.customer_name
          }
        });

        if (error) throw error;
        
        if (data?.success && data?.qr_code_url) {
          console.log('✅ QR code generated successfully');
          setQrCodeUrl(data.qr_code_url);
          setRazorpayQrId(data.qr_code_id);
          setShowRazorpayQR(true);
        } else {
          throw new Error('Failed to generate QR code');
        }
      } catch (error) {
        console.error('❌ QR generation failed:', error);
        toast({
          title: "QR Code Generation Failed",
          description: "Could not generate payment QR code. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsGeneratingQR(false);
      }
      return;
    }
    
    // For COD, call backend to complete delivery
    setIsProcessing(true);
    
    try {
      console.log('🚀 Completing delivery with COD payment method');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('📤 Invoking unified-complete-delivery function...');

      const { data, error } = await supabase.functions.invoke('unified-complete-delivery', {
        body: {
          order_id: order.order_id,
          payment_method: method.toUpperCase()
        }
      });

      console.log('📥 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data) {
        console.error('❌ No data returned from edge function');
        throw new Error('No response from server');
      }

      if (data.success === false) {
        console.error('❌ Delivery completion failed:', data);
        throw new Error(data.error || 'Failed to complete delivery');
      }

      console.log('✅ Delivery completion successful:', data);

      // Show success with payout info
      const payoutAmount = data.payout_amount || 25;
      const isAlreadyCompleted = data.already_completed || false;
      
      toast({
        title: isAlreadyCompleted ? "✅ Already Completed" : "✅ Product Delivered Successfully!",
        description: `Delivery Type: Cash on Delivery (COD) • Agent Earned: ₹${payoutAmount}`,
      });

      // Invalidate queries to refresh from server
      await queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['delivery-history'] });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        await onSuccess(method);
      }
      
      // Close dialog after successful completion
      onOpenChange(false);
      
    } catch (error) {
      console.error('❌ Delivery completion failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Delivery Failed",
        description: `Error: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentComplete = async () => {
    setIsProcessing(true);
    
    try {
      console.log('🚀 Completing delivery with Online payment after QR scan');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('📤 Invoking unified-complete-delivery function for Online payment...');

      const { data, error } = await supabase.functions.invoke('unified-complete-delivery', {
        body: {
          order_id: order.order_id,
          payment_method: 'ONLINE'
        }
      });

      console.log('📥 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data) {
        console.error('❌ No data returned from edge function');
        throw new Error('No response from server');
      }

      if (data.success === false) {
        console.error('❌ Delivery completion failed:', data);
        throw new Error(data.error || 'Failed to complete delivery');
      }

      console.log('✅ Delivery completion successful:', data);

      // Show success with payout info
      const payoutAmount = data.payout_amount || 25;
      const isAlreadyCompleted = data.already_completed || false;
      
      toast({
        title: isAlreadyCompleted ? "✅ Already Completed" : "✅ Delivery Successfully Completed!",
        description: `Payment received via Online Payment • Agent Earned: ₹${payoutAmount}`,
      });

      // Invalidate queries to refresh from server
      await queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['delivery-history'] });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        await onSuccess('Online');
      }
      
      // Close all dialogs
      setShowRazorpayQR(false);
      onOpenChange(false);
      
    } catch (error) {
      console.error('❌ Delivery completion failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Delivery Failed",
        description: `Error: ${errorMessage}`,
        variant: "destructive"
      });
      setShowRazorpayQR(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
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
                    disabled={isProcessing || isGeneratingQR}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                  >
                    {isGeneratingQR ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating QR...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Online Payment
                      </>
                    )}
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

      {/* Razorpay QR Code Full Screen Overlay */}
      {showRazorpayQR && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-3 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-3 max-w-[340px] w-full max-h-[95vh] overflow-y-auto shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRazorpayQR(false)}
              disabled={isProcessing}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full hover:bg-gray-100 z-10"
            >
              <X className="h-3.5 w-3.5" />
            </Button>

            <div className="text-center space-y-2.5 pt-1">
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-0.5">
                  Scan QR to Pay
                </h2>
                <p className="text-xs text-gray-600">
                  Customer should scan & pay with any UPI app
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-2.5 rounded-lg">
                {qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt="UPI Payment QR Code" 
                    className="w-full max-w-[200px] mx-auto rounded-md shadow-lg"
                  />
                ) : (
                  <div className="w-full max-w-[200px] mx-auto h-40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-0.5 py-1">
                <p className="text-xs text-gray-600">Order Amount</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{order.total_amount}
                </p>
                <p className="text-xs text-gray-500 truncate px-2">
                  {order.customer_name}
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <Button
                  onClick={handlePaymentComplete}
                  disabled={isProcessing}
                  className="w-full h-9 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-semibold shadow-lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      ✓ Payment Complete
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowRazorpayQR(false)}
                  disabled={isProcessing}
                  className="w-full h-8 text-sm"
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-gray-500 pt-0.5 leading-tight">
                {isCheckingPayment ? '⏳ Detecting payment...' : 'Waiting for payment or click "Payment Complete" button'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};