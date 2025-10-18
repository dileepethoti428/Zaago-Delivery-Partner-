import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Scanner } from "@yudiel/react-qr-scanner";
import { X, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import { DeliveryErrorDialog } from "./DeliveryErrorDialog";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeliveryComplete?: () => void;
}

interface ScannedOrder {
  order_id: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  payment_status: string;
  address?: any;
  items?: any[];
  special_instructions?: string;
  delivery_time_slot?: string;
  estimated_payout?: number;
}

interface PaymentOption {
  value: string;
  label: string;
  description: string;
}

export const QrScannerDialog = ({ open, onOpenChange, onDeliveryComplete }: QrScannerDialogProps) => {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(true);
  const [scannedOrder, setScannedOrder] = useState<ScannedOrder | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState<string>('');
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState<ScannedOrder | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    canRetry: boolean;
  }>({
    title: "Delivery Failed",
    message: "",
    canRetry: true,
  });

  const handleScan = async (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    
    const result = detectedCodes[0].rawValue;
    try {
      setIsScanning(false);
      setCurrentQrCode(result);
      
      console.log('🔍 Scanning QR code:', result);
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Current session:', !!session);
      
      if (!session) {
        setErrorDetails({
          title: "Authentication Required",
          message: "Please log in to scan QR codes and complete deliveries.",
          canRetry: false,
        });
        setShowErrorDialog(true);
        onOpenChange(false);
        return;
      }
      
      // Use the new qr-scan-order function to validate and get order info
      const { data, error } = await supabase.functions.invoke('qr-scan-order', {
        body: {
          qr_code_data: result
        }
      });

      console.log('📱 QR scan response:', { data, error });

      if (error) {
        console.error('❌ QR scan error:', error);
        
        // For function invocation errors (like 403, 400), try to extract the actual error from the response
        if (error.message?.includes('non-2xx status code')) {
          console.log('⚠️ Non-2xx status, checking response data for specific error...');
          // For Supabase function errors, the actual error details are often in the data response
          // Let it fall through to parse the data object for specific error details
        } else if (error.message?.includes('Authentication') || error.message?.includes('401')) {
          setErrorDetails({
            title: "Authentication Error",
            message: "Your session has expired. Please log out and log back in, then try again.",
            canRetry: false,
          });
          setShowErrorDialog(true);
          onOpenChange(false);
          return;
        } else {
          // Network/connection issues
          setErrorDetails({
            title: "Connection Error",
            message: "Unable to connect to the server. Please check your internet connection and try again.",
            canRetry: true,
          });
          setShowErrorDialog(true);
          onOpenChange(false);
          return;
        }
      }

      // Handle special "already delivered" status from qr-scan-order
      if (data && data.status === 'already_delivered') {
        console.log('✅ Order already delivered, showing delivered status');
        
        // Show a special dialog for already delivered orders
        setScannedOrder({
          order_id: data.order.id,
          customer_name: data.order.customer_name,
          customer_phone: '',
          total_amount: data.order.total,
          payment_status: 'completed',
          address: null,
          items: [],
          special_instructions: 'This order has already been completed and delivered.',
          delivery_time_slot: '',
          estimated_payout: 0
        });
        setShowPaymentDialog(true);
        toast({
          title: "Product Already Delivered ✅",
          description: `This order for ${data.order.customer_name} has already been completed.`,
          variant: "default"
        });
        return;
      }

      // Handle "already paid online" status - show success screen after completing delivery
      if (data && data.status === 'already_paid') {
        console.log('✅ Order already paid online, completing delivery and showing success screen');
        
        try {
          setIsProcessing(true);
          
          // Complete delivery immediately with Online payment, passing QR code data directly
          const deliveryResult = await completeDelivery('Online', result);
          
          // Show success screen with order details
          setSuccessOrderData({
            order_id: data.order.id,
            customer_name: data.order.customer_name,
            customer_phone: '',
            total_amount: data.order.total,
            payment_status: 'completed',
            estimated_payout: data.order.estimated_payout || 0
          });
          setShowSuccessScreen(true);
          
          // Dispatch orderCompleted event for immediate refresh
          window.dispatchEvent(new CustomEvent('orderCompleted', { 
            detail: { orderId: data.order.id } 
          }));
          
        } catch (error) {
          console.error('❌ Auto-completion failed:', error);
          setErrorDetails({
            title: "Delivery Failed",
            message: error instanceof Error 
              ? error.message 
              : "We couldn't complete this delivery. Please try again or contact support if the issue persists.",
            canRetry: true,
          });
          setShowErrorDialog(true);
          onOpenChange(false);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Handle error responses from the edge function (both with and without error object)
      if (error || !data || !data.success) {
        let errorMsg = 'Invalid QR code';
        let userFriendlyTitle = 'Delivery Failed';
        let userFriendlyMessage = '';
        
        // If there's an error object and it contains a non-2xx status, try to extract details
        if (error && error.message?.includes('non-2xx status code')) {
          errorMsg = data?.error || data?.message || error.message || 'Invalid QR code';
        } else if (data && !data.success) {
          errorMsg = data.error || data.message || 'Invalid QR code';
        } else if (error) {
          errorMsg = error.message || 'Invalid QR code';
        }
        
        console.error('❌ QR scan failed:', errorMsg);
        
        // Map technical errors to user-friendly messages
        if (errorMsg.includes('not assigned to you') || 
            errorMsg.includes('Order is not assigned to you') ||
            errorMsg.includes('Order not ready for delivery') ||
            errorMsg.includes('not ready for delivery') ||
            errorMsg.includes('not ready') ||
            (errorMsg.includes('Edge Function returned a non-2xx status code') && error && error.message?.includes('non-2xx status code'))) {
          userFriendlyTitle = "Order Not Assigned";
          userFriendlyMessage = "This order is assigned to another delivery agent. Only the assigned agent can scan and complete this delivery.";
        } else if (errorMsg.includes('already delivered')) {
          userFriendlyTitle = "Already Delivered";
          userFriendlyMessage = "This order has already been completed and delivered successfully.";
        } else if (errorMsg.includes('already used') || errorMsg.includes('already scanned')) {
          userFriendlyTitle = "QR Code Already Used";
          userFriendlyMessage = "This QR code was already scanned. If the previous delivery failed, please contact support for assistance.";
        } else if (errorMsg.includes('Invalid QR')) {
          userFriendlyTitle = "Invalid QR Code";
          userFriendlyMessage = "This QR code is not valid. Please scan the correct order QR code provided by the customer.";
        } else if (errorMsg.includes('connection') || errorMsg.includes('network') || errorMsg.includes('offline')) {
          userFriendlyTitle = "Connection Issue";
          userFriendlyMessage = "Unable to connect to the server. Please check your internet connection and try again.";
        } else {
          userFriendlyTitle = "Delivery Failed";
          userFriendlyMessage = errorMsg || "We couldn't process this QR code. Please try again or contact support if the issue persists.";
        }
        
        setErrorDetails({
          title: userFriendlyTitle,
          message: userFriendlyMessage,
          canRetry: true,
        });
        setShowErrorDialog(true);
        onOpenChange(false);
        return;
      }

      const order = data.order;
      const paymentOpts = data.payment_options || [];
      
      // Set scanned order data
      setScannedOrder({
        order_id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        total_amount: order.total,
        payment_status: 'pending', // Will be set based on selection
        address: order.address,
        items: order.items,
        special_instructions: order.special_instructions,
        delivery_time_slot: order.delivery_time_slot,
        estimated_payout: order.estimated_payout
      });

      setPaymentOptions(paymentOpts);

      toast({
        title: "QR Code Scanned! 📱",
        description: `Order for ${order.customer_name} - ₹${order.total}. Estimated payout: ₹${order.estimated_payout}`,
      });

      // Close scanner and show payment options
      onOpenChange(false);
      setShowPaymentDialog(true);

    } catch (error) {
      console.error('❌ QR Scan error:', error);
      setErrorDetails({
        title: "Scan Failed",
        message: "Unable to process QR code. Please try scanning again.",
        canRetry: true,
      });
      setShowErrorDialog(true);
      onOpenChange(false);
    }
  };

  const handleError = (error: any) => {
    console.error('QR Scanner error:', error);
    
    let title = "Camera Error";
    let description = "Unable to access camera.";
    
    // Handle different types of camera errors
    if (error?.name === 'NotAllowedError' || error?.message?.includes('Permission denied')) {
      title = "Camera Permission Denied";
      description = "Please allow camera access in your browser settings and refresh the page.";
    } else if (error?.name === 'NotFoundError' || error?.message?.includes('No camera')) {
      title = "No Camera Found";
      description = "No camera device found. Please connect a camera and try again.";
    } else if (error?.name === 'NotReadableError' || error?.message?.includes('in use')) {
      title = "Camera In Use";
      description = "Camera is being used by another application. Please close other apps and try again.";
    } else if (error?.name === 'NotSupportedError') {
      title = "Camera Not Supported";
      description = "Your browser doesn't support camera access. Please use a modern browser.";
    } else if (error?.message?.includes('https')) {
      title = "HTTPS Required";
      description = "Camera access requires a secure connection. Please use HTTPS.";
    }
    
    toast({
      title,
      description,
      variant: "destructive"
    });
    
    // Reset scanner state so user can try again
    setIsScanning(true);
  };

  const completeDelivery = async (paymentMethod: string, qrCodeData?: string) => {
    const qrData = qrCodeData || currentQrCode;
    
    if (!qrData) {
      setErrorDetails({
        title: "Missing QR Data",
        message: "No QR code data available. Please scan the QR code again.",
        canRetry: true,
      });
      setShowErrorDialog(true);
      throw new Error("No QR code data available");
    }

    try {
      console.log('🚚 Completing QR delivery with payment method:', paymentMethod);
      
      // Use the original qr-complete-delivery function
      const { data: result, error: functionError } = await supabase.functions.invoke('qr-complete-delivery', {
        body: {
          qr_code_data: qrData,
          payment_method: paymentMethod
        }
      });

      if (functionError) {
        console.error('QR delivery completion error:', functionError);
        throw new Error(`Delivery completion failed: ${functionError.message}`);
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to complete delivery');
      }

      console.log('✅ QR Delivery completed successfully');
      
      // Reset scanner state
      setScannedOrder(null);
      setShowPaymentDialog(false);
      setIsScanning(true);
      
      // Trigger refresh callback to update MyDeliveries list
      if (onDeliveryComplete) {
        console.log('📱 Calling onDeliveryComplete callback to refresh orders');
        onDeliveryComplete();
      }
      
      return result;

    } catch (error) {
      console.error('💥 QR delivery completion failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(errorMessage);
    }
  };

  const resetScanner = () => {
    setIsScanning(true);
    setScannedOrder(null);
    setPaymentOptions([]);
    setShowPaymentDialog(false);
    setCurrentQrCode('');
    setShowSuccessScreen(false);
    setSuccessOrderData(null);
    setShowErrorDialog(false);
    setErrorDetails({
      title: "Delivery Failed",
      message: "",
      canRetry: true,
    });
  };

  const handleErrorRetry = () => {
    resetScanner();
    onOpenChange(true);
  };

  const handleContactSupport = () => {
    // Navigate to help page
    window.location.href = '/help';
  };

  const handleSuccessClose = () => {
    setShowSuccessScreen(false);
    setSuccessOrderData(null);
    onOpenChange(false);
    
    // Trigger the callback to refresh home page
    if (onDeliveryComplete) {
      onDeliveryComplete();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
              Scan QR Code
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative aspect-square w-full max-w-xs mx-auto overflow-hidden rounded-lg border-2 border-primary/20">
              {isScanning ? (
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{
                    facingMode: 'environment', // Use back camera by default
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                  }}
                  formats={['qr_code', 'code_128', 'code_39']}
                  styles={{
                    container: {
                      width: '100%',
                      height: '100%'
                    }
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <div className="text-center">
                    <div className="text-gray-500 mb-2">📷</div>
                    <p className="text-sm text-gray-600">Camera stopped</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Position the QR code within the frame to scan
              </p>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              {!isScanning && (
                <Button
                  onClick={resetScanner}
                  className="flex-1 bg-gradient-neon hover:shadow-neon"
                >
                  Scan Again
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Screen Dialog */}
      <Dialog open={showSuccessScreen} onOpenChange={setShowSuccessScreen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-success" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Product Delivered Successfully ✅
                </h2>
                <p className="text-muted-foreground">
                  The order has been completed and marked as delivered
                </p>
              </div>

              {successOrderData && (
                <div className="w-full space-y-3 pt-2">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Customer</span>
                    <span className="font-semibold text-foreground">{successOrderData.customer_name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Order Amount</span>
                    <span className="font-semibold text-foreground">₹{successOrderData.total_amount}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg border border-success/20">
                    <span className="text-sm text-muted-foreground">Your Earnings</span>
                    <span className="font-bold text-success text-lg">₹{successOrderData.estimated_payout}</span>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleSuccessClose}
              className="w-full bg-gradient-neon hover:shadow-neon"
              size="lg"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {scannedOrder && (
        <PaymentMethodDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          order={scannedOrder}
          selectionOnly={true}
          onSuccess={async (paymentMethod) => {
            return await completeDelivery(paymentMethod);
          }}
        />
      )}

      <DeliveryErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        title={errorDetails.title}
        message={errorDetails.message}
        onRetry={handleErrorRetry}
        onContactSupport={handleContactSupport}
        canRetry={errorDetails.canRetry}
      />
    </>
  );
};