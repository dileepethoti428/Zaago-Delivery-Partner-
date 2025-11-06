import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Banknote, QrCode } from 'lucide-react';

interface PaymentMethodDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectMethod: (method: 'COD' | 'ONLINE') => void;
  amount: number;
}

export function PaymentMethodDialog({ 
  open, 
  onClose, 
  onSelectMethod, 
  amount 
}: PaymentMethodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">Choose Payment Method</DialogTitle>
          <p className="text-center text-muted-foreground">
            Total Amount: <span className="font-bold text-primary">₹{amount}</span>
          </p>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button
            onClick={() => onSelectMethod('COD')}
            className="w-full h-24 rounded-2xl text-lg font-medium"
            variant="outline"
          >
            <div className="flex flex-col items-center gap-2">
              <Banknote className="h-8 w-8" />
              <span>Cash on Delivery</span>
            </div>
          </Button>
          
          <Button
            onClick={() => onSelectMethod('ONLINE')}
            className="w-full h-24 rounded-2xl text-lg font-medium"
          >
            <div className="flex flex-col items-center gap-2">
              <QrCode className="h-8 w-8" />
              <span>Pay Online (UPI/QR)</span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
