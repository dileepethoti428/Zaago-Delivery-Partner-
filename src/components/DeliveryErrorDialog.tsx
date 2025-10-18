import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, HeadphonesIcon } from "lucide-react";

interface DeliveryErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
  canRetry?: boolean;
}

export const DeliveryErrorDialog = ({
  open,
  onOpenChange,
  title = "Delivery Failed",
  message,
  onRetry,
  onContactSupport,
  canRetry = true,
}: DeliveryErrorDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm bg-background border-destructive/20">
        <AlertDialogHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
          </div>
          
          <AlertDialogTitle className="text-center text-xl font-bold text-foreground">
            {title}
          </AlertDialogTitle>
          
          <AlertDialogDescription className="text-center text-base text-muted-foreground leading-relaxed">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col sm:flex-col space-y-2 mt-2">
          {canRetry && onRetry && (
            <Button
              onClick={() => {
                onRetry();
                onOpenChange(false);
              }}
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          
          {onContactSupport && (
            <Button
              onClick={() => {
                onContactSupport();
                onOpenChange(false);
              }}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <HeadphonesIcon className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          )}
          
          {!canRetry && !onContactSupport && (
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Close
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
