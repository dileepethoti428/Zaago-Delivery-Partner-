import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Scanner } from "@yudiel/react-qr-scanner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PaymentMethodDialog } from "./PaymentMethodDialog";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const QrScannerDialog = ({ open, onOpenChange }: QrScannerDialogProps) => {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(true);
  const [scannedOrder, setScannedOrder] = useState<ScannedOrder | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState<string>('');

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
        toast({
          title: "Authentication Required",
          description: "Please log in to scan QR codes.",
          variant: "destructive"
        });
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
          toast({
            title: "Authentication Error",
            description: "Please log out and log back in, then try again.",
            variant: "destructive"
          });
          onOpenChange(false);
          return;
        } else {
          // Only show generic error for actual network/connection issues
          toast({
            title: "Scan Failed", 
            description: error.message || "Unable to process QR code. Please try again.",
            variant: "destructive"
          });
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

      // Handle error responses from the edge function (both with and without error object)
      if (error || !data || !data.success) {
        let errorMsg = 'Invalid QR code';
        
        // If there's an error object and it contains a non-2xx status, try to extract details
        if (error && error.message?.includes('non-2xx status code')) {
          // For Supabase function errors with non-2xx status, check if data has error details
          errorMsg = data?.error || data?.message || error.message || 'Invalid QR code';
        } else if (data && !data.success) {
          // If no error object but data indicates failure
          errorMsg = data.error || data.message || 'Invalid QR code';
        } else if (error) {
          // For other types of errors
          errorMsg = error.message || 'Invalid QR code';
        }
        
        console.error('❌ QR scan failed:', errorMsg);
        
        // Special handling for specific error messages
        // For 403 errors, Supabase returns generic "Edge Function returned a non-2xx status code" 
        // which means the order is not assigned to this user
        if (errorMsg.includes('not assigned to you') || 
            errorMsg.includes('Order is not assigned to you') ||
            (errorMsg.includes('Edge Function returned a non-2xx status code') && error && error.message?.includes('non-2xx status code'))) {
          toast({
            title: "🚫 Order Not Assigned to You",
            description: "This order is assigned to another delivery agent. Only the assigned agent can scan and complete this delivery.",
            variant: "destructive"
          });
        } else if (errorMsg.includes('Order not ready for delivery') || errorMsg.includes('not ready for delivery')) {
          toast({
            title: "🚫 Order Not Assigned to You",
            description: "This order is assigned to another delivery agent. Only the assigned agent can scan and complete this delivery.",
            variant: "destructive"
          });
        } else if (errorMsg.includes('already delivered')) {
          toast({
            title: "Product Already Delivered ✅",
            description: "This order has already been completed and delivered.",
            variant: "default"
          });
        } else if (errorMsg.includes('already used') || errorMsg.includes('already scanned')) {
          toast({
            title: "QR Code Already Used",
            description: "This QR code was already scanned. If the previous delivery failed, please contact admin for assistance.",
            variant: "destructive"
          });
        } else if (errorMsg.includes('not ready')) {
          toast({
            title: "🚫 Order Not Assigned to You",
            description: "This order is assigned to another delivery agent. Only the assigned agent can scan and complete this delivery.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Invalid QR Code",
            description: errorMsg,
            variant: "destructive"
          });
        }
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
      toast({
        title: "Scan Failed",
        description: "Unable to process QR code. Please try again.",
        variant: "destructive"
      });
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

  const completeDelivery = async (paymentMethod: string) => {
    if (!currentQrCode) {
      toast({
        title: "Error",
        description: "No QR code data available",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      console.log('🚚 Completing delivery with payment method:', paymentMethod);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('User not authenticated');
      }

      // Get agent info
      const { data: agentCheck } = await supabase
        .from('delivery_agents')
        .select('id, email')
        .eq('email', user.email)
        .eq('is_active', true)
        .single();

      if (!agentCheck || !scannedOrder?.order_id) {
        throw new Error('Invalid agent or order data');
      }
      
      // Call the edge function to complete delivery
      const { data: result, error: functionError } = await supabase.functions.invoke('bulletproof-complete-delivery', {
        body: {
          order_id: scannedOrder.order_id,
          payment_method: paymentMethod,
          agent_id: agentCheck.id
        }
      });

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error(`Delivery completion failed: ${functionError.message}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete delivery');
      }

      // Success case
      console.log('✅ QR Delivery completed successfully via edge function');
      toast({
        title: "Product Delivered! ✅",
        description: `Order completed via QR scan. Earnings: ₹${scannedOrder?.estimated_payout || 25}`,
        variant: "default"
      });
      
      // Reset states
      setScannedOrder(null);
      setShowPaymentDialog(false);
      setCurrentQrCode('');
      
      // Refresh the orders list
      window.dispatchEvent(new CustomEvent('orderCompleted', { 
        detail: { orderId: scannedOrder.order_id } 
      }));
      
    } catch (error) {
      console.error('❌ QR delivery completion error:', error);
      toast({
        title: "Delivery Failed",
        description: error instanceof Error ? error.message : "QR delivery completion failed",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setIsScanning(true);
    setScannedOrder(null);
    setPaymentOptions([]);
    setShowPaymentDialog(false);
    setCurrentQrCode('');
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

      {scannedOrder && (
        <PaymentMethodDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          order={scannedOrder}
          selectionOnly={true}
          onSuccess={async (paymentMethod) => {
            await completeDelivery(paymentMethod);
          }}
        />
      )}
    </>
  );
};