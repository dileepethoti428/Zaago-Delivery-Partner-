import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeliveryErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
  showRetry?: boolean;
  showSupport?: boolean;
}

export const DeliveryErrorDialog = ({
  open,
  onOpenChange,
  title = "Delivery Failed",
  message,
  onRetry,
  onContactSupport,
  showRetry = true,
  showSupport = true,
}: DeliveryErrorDialogProps) => {
  const handleContactSupport = () => {
    onOpenChange(false);
    if (onContactSupport) {
      onContactSupport();
    } else {
      // Default: Navigate to help page
      window.location.href = "/help";
    }
  };

  const handleRetry = () => {
    onOpenChange(false);
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm bg-card border-destructive/20">
        <AlertDialogHeader className="items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          
          <AlertDialogTitle className="text-2xl font-bold text-foreground">
            {title}
          </AlertDialogTitle>
          
          <AlertDialogDescription className="text-base text-muted-foreground leading-relaxed">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex-col space-y-2 sm:space-y-2">
          {showSupport && (
            <AlertDialogCancel asChild>
              <Button
                variant="outline"
                onClick={handleContactSupport}
                className="w-full"
              >
                Contact Support
              </Button>
            </AlertDialogCancel>
          )}
          
          {showRetry && (
            <AlertDialogAction asChild>
              <Button
                onClick={handleRetry}
                className="w-full bg-gradient-neon hover:shadow-neon"
              >
                Try Again
              </Button>
            </AlertDialogAction>
          )}
          
          {!showRetry && !showSupport && (
            <AlertDialogCancel asChild>
              <Button variant="outline" className="w-full">
                Close
              </Button>
            </AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
