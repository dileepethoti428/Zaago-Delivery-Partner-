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

interface DeliveryCompletionResult {
  success: boolean;
  message?: string;
  order_id?: string;
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
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      // Get current user and their agent profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not authenticated");

      // Get agent profile by email (delivery_agents uses email, not user_id)
      // @ts-ignore - Supabase type inference issue
      const agentQuery = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agentQuery.error || !agentQuery.data) {
        throw new Error("Agent profile not found. Please contact support.");
      }

      const agentId = agentQuery.data.id;

      console.log("🔄 Starting delivery completion:", { orderId, agentId, paymentStatus });

      // Store old data for proper rollback if needed
      const oldOrdersData = queryClient.getQueryData(['orders']);

      // OPTIMISTIC UPDATE: Remove order from cache immediately
      queryClient.setQueryData(['orders'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          orders: oldData.orders?.filter((order: any) => order.id !== orderId) || []
        };
      });

      console.log("🚀 Calling complete_delivery_safe_wrapper RPC...");

      // Call the safe wrapper function that catches ALL exceptions
      const { data: rawData, error } = await supabase.rpc('complete_delivery_safe_wrapper', {
        p_order_id: orderId,
        p_agent_id: agentId,
        p_payment_method: (paymentStatus === "paid" || paymentStatus === "paid_online") ? "ONLINE" : "COD"
      });

      console.log("📦 RPC Response:", { rawData, error });

      if (error) {
        console.error("❌ RPC Error:", error);
        throw error;
      }

      const data = rawData as unknown as DeliveryCompletionResult;

      if (!data?.success) {
        console.error("❌ Delivery completion failed:", data?.message);
        throw new Error(data?.message || "Failed to complete delivery");
      }

      console.log("✅ Delivery completed successfully:", data);

      // Show success message
      toast({
        title: "Product successfully delivered",
        description: `Delivery for ${customerName} completed`,
      });

      // Dispatch event for Home page to refresh (silently)
      console.log("📡 Dispatching orderCompleted event...");
      window.dispatchEvent(new CustomEvent('orderCompleted', { 
        detail: { orderId, customerName } 
      }));

      // Wait a bit for the event to process, then navigate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("🏠 Navigating to home...");
      navigate("/");

    } catch (error: any) {
      console.error("❌ Delivery completion failed:", error);

      // Rollback optimistic update - refetch from server
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
