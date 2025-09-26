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
        
        // Enhanced error handling with specific status codes
        if (error.message?.includes('Authentication') || error.message?.includes('401')) {
          toast({
            title: "Authentication Error",
            description: "Please log out and log back in, then try again.",
            variant: "destructive"
          });
        } else if (error.message?.includes('403') || error.message?.includes('not assigned')) {
          toast({
            title: "Access Denied",
            description: "This order is assigned to another delivery agent.",
            variant: "destructive"
          });
        } else if (error.message?.includes('400') || error.message?.includes('already used')) {
          toast({
            title: "QR Code Already Used",
            description: "This QR code was already scanned. If delivery failed, contact admin.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Scan Failed", 
            description: error.message || "Unable to process QR code. Please try again.",
            variant: "destructive"
          });
        }
        onOpenChange(false);
        return;
      }

      if (!data || !data.success) {
        const errorMsg = data?.error || data?.message || 'Invalid QR code';
        console.error('❌ QR scan failed:', errorMsg);
        
        // Special handling for "order not assigned" error
        if (errorMsg.includes('not assigned to you')) {
          toast({
            title: "Order Not Assigned",
            description: "This order is assigned to another delivery agent. Only the assigned agent can complete this delivery.",
            variant: "destructive"
          });
        } else if (errorMsg.includes('already delivered')) {
          toast({
            title: "Order Already Delivered ✅",
            description: "This order has already been completed.",
            variant: "default"
          });
        } else if (errorMsg.includes('already used') || errorMsg.includes('already scanned')) {
          toast({
            title: "QR Code Already Used",
            description: "This QR code was already scanned. If the previous delivery failed, please contact admin for assistance.",
            variant: "destructive"
          });
        } else if (errorMsg.includes('not ready') || errorMsg.includes('status')) {
          toast({
            title: "Order Not Ready",
            description: "This order is not ready for delivery. Please check the order status.",
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
    toast({
      title: "Camera Error",
      description: "Unable to access camera. Please check permissions.",
      variant: "destructive"
    });
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
      
      const { data, error } = await supabase.functions.invoke('qr-complete-delivery', {
        body: {
          qr_code_data: currentQrCode,
          payment_method: paymentMethod
        }
      });

      console.log('📦 Delivery completion response:', { data, error });

      if (error) {
        console.error('❌ Delivery completion error:', error);
        throw new Error(error.message || 'Failed to complete delivery');
      }

      if (data && data.success) {
        toast({
          title: "Product Delivered! ✅",
          description: `Successfully delivered to ${data.order.customer_name}. Earned: ₹${data.order.payout_amount}`,
        });
        
        // Reset states
        setScannedOrder(null);
        setShowPaymentDialog(false);
        setCurrentQrCode('');
        
        // Refresh the orders list by dispatching a custom event
        window.dispatchEvent(new CustomEvent('orderCompleted', { 
          detail: { orderId: data.order.id } 
        }));
      } else {
        throw new Error(data?.error || 'Failed to complete delivery');
      }
    } catch (error) {
      console.error('❌ Complete delivery error:', error);
      toast({
        title: "Delivery Failed",
        description: error instanceof Error ? error.message : "Unable to complete delivery. Please try again.",
        variant: "destructive"
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
              {isScanning && (
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  styles={{
                    container: {
                      width: '100%',
                      height: '100%'
                    }
                  }}
                />
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