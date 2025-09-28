import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote } from "lucide-react";

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

  const handlePaymentMethod = (method: 'COD' | 'Online') => {
    if (onSuccess) {
      onSuccess(method);
    }
    
    // Show immediate success toast
    toast({
      title: "✅ Product Delivered Successfully!",
      description: `Payment method: ${method === 'COD' ? 'Cash on Delivery' : 'Online Payment'}`,
      variant: "default"
    });
    
    // Close dialog immediately
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground text-center">
            Select Payment Method
          </DialogTitle>
          <DialogDescription className="text-center">
            Choose how the customer paid for this order
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
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
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              <Banknote className="w-5 h-5 mr-2" />
              Cash on Delivery (COD)
            </Button>
            
            <Button
              onClick={() => handlePaymentMethod('Online')}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Online Payment
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};