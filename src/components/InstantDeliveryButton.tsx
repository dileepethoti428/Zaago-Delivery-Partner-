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
      // Show optimistic success message immediately
      toast({
        title: "Product successfully delivered",
        description: `Delivery for ${customerName} completed`,
      });

      // Optimistically remove from UI
      queryClient.setQueryData(["orders"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((order: any) => order.id !== orderId);
      });

      // Navigate back immediately for better UX
      setTimeout(() => navigate("/"), 100);

      // Call the backend in background
      const { data, error } = await supabase.functions.invoke(
        "complete-delivery-instant",
        {
          body: {
            order_id: orderId,
            payment_method: paymentStatus === "paid" ? "ONLINE" : "COD",
          },
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Failed to complete delivery");
      }

      console.log("✅ Delivery completed successfully:", data);

      // Invalidate queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-history"] });

    } catch (error: any) {
      console.error("❌ Delivery completion failed:", error);

      // Rollback optimistic update
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      toast({
        title: "Failed to update delivery status",
        description: error.message || "Please try again",
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
