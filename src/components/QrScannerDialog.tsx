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
  total_amount: number;
  payment_status: string;
}

export const QrScannerDialog = ({ open, onOpenChange }: QrScannerDialogProps) => {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(true);
  const [scannedOrder, setScannedOrder] = useState<ScannedOrder | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScan = async (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    
    const result = detectedCodes[0].rawValue;
    try {
      setIsScanning(false);
      
      // Validate QR code with backend
      const { data: qrData, error } = await supabase
        .from('order_qr_codes')
        .select(`
          order_id,
          orders (
            id,
            total,
            customer_name,
            status,
            payment_status
          )
        `)
        .eq('qr_code_data', result)
        .eq('is_scanned', false)
        .single();

      if (error || !qrData) {
        toast({
          title: "Invalid QR Code",
          description: "This QR code is not valid or has already been used",
          variant: "destructive"
        });
        onOpenChange(false);
        return;
      }

      const order = qrData.orders as any;
      if (order.status !== 'assigned') {
        toast({
          title: "Order Not Ready",
          description: "This order is not assigned to you yet",
          variant: "destructive"
        });
        onOpenChange(false);
        return;
      }

      // Set scanned order data
      setScannedOrder({
        order_id: order.id,
        customer_name: order.customer_name,
        total_amount: order.total,
        payment_status: order.payment_status
      });

      toast({
        title: "QR Code Scanned!",
        description: `Order for ${order.customer_name} - ₹${order.total}`,
      });

      // Store QR data for later use
      localStorage.setItem('last_scanned_qr', result);

      // Close scanner
      onOpenChange(false);

      // For prepaid orders, complete delivery directly
      if (order.payment_status === 'prepaid') {
        await completeDelivery(result, 'prepaid');
      } else {
        // For COD orders, show payment options
        setShowPaymentDialog(true);
      }

    } catch (error) {
      console.error('QR Scan error:', error);
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

  const completeDelivery = async (qrCodeData: string, paymentMethod: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('qr-complete-delivery', {
        body: {
          qr_code_data: qrCodeData,
          payment_method: paymentMethod
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Order Completed! ✅",
          description: `Delivery completed for ${data.order.customer_name}`,
        });
        
        // Reset states
        setScannedOrder(null);
        setShowPaymentDialog(false);
        
        // Refresh the orders list by dispatching a custom event
        window.dispatchEvent(new CustomEvent('orderCompleted'));
      } else {
        throw new Error(data.error || 'Failed to complete delivery');
      }
    } catch (error) {
      console.error('Complete delivery error:', error);
      toast({
        title: "Delivery Failed",
        description: "Unable to complete delivery. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setIsScanning(true);
    setScannedOrder(null);
    setShowPaymentDialog(false);
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

      {scannedOrder && scannedOrder.payment_status !== 'prepaid' && (
        <PaymentMethodDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          order={scannedOrder}
          selectionOnly={true}
          onSuccess={async (paymentMethod) => {
            const qrCodeData = localStorage.getItem('last_scanned_qr') || '';
            await completeDelivery(qrCodeData, paymentMethod);
            localStorage.removeItem('last_scanned_qr');
          }}
        />
      )}
    </>
  );
};