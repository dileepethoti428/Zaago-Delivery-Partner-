import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface InstantDeliveryButtonProps {
  orderId: string;
  orderTotal: number;
  customerName: string;
  paymentStatus: string;
  className?: string;
}

export const InstantDeliveryButton = ({
  orderId,
  orderTotal,
  customerName,
  paymentStatus,
  className = "",
}: InstantDeliveryButtonProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleInstantComplete = async () => {
    // Prevent double-clicks
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      // Call the backend FIRST before UI updates
      const { data, error } = await supabase.functions.invoke(
        "complete-delivery-instant",
        {
          body: {
            order_id: orderId,
            payment_method: (paymentStatus === "paid" || paymentStatus === "paid_online") ? "ONLINE" : "COD",
          },
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to complete delivery");
      }

      console.log("✅ Delivery completed successfully:", data);

      // Show success message
      toast({
        title: "Product successfully delivered",
        description: `Delivery for ${customerName} completed`,
      });

      // Dispatch event for Home page to refresh
      window.dispatchEvent(new CustomEvent('orderCompleted', { 
        detail: { orderId, customerName } 
      }));

      // Navigate back after successful completion
      setTimeout(() => navigate("/"), 300);

    } catch (error: any) {
      console.error("❌ Delivery completion failed:", error);

      // Rollback optimistic update
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      toast({
        title: "Failed to update delivery status",
        description: error.message || error.error || "Please try again",
        variant: "destructive",
      });

      // Navigate back on error too
      navigate("/");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      onClick={handleInstantComplete}
      disabled={isProcessing}
      className={className}
      size="lg"
    >
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        "Mark as Delivered"
      )}
    </Button>
  );
};
