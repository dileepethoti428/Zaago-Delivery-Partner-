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
      // 1. PRE-VALIDATION: Check Supabase client
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      // 2. PRE-VALIDATION: Check authentication and session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated. Please log in again.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("User email not found");
      }

      // 3. PRE-VALIDATION: Get agent profile
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
      const paymentMethod = (paymentStatus === "paid" || paymentStatus === "paid_online") ? "ONLINE" : "COD";

      console.log("🔄 Starting delivery completion with validated data:", { 
        orderId, 
        agentId, 
        paymentMethod,
        userEmail: user.email 
      });

      // Store old data for rollback if needed
      const oldOrdersData = queryClient.getQueryData(['orders']);

      // OPTIMISTIC UPDATE: Remove order from cache immediately
      queryClient.setQueryData(['orders'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          orders: oldData.orders?.filter((order: any) => order.id !== orderId) || []
        };
      });

      // 4. TIMEOUT WRAPPER: Prevent hanging calls
      const timeout = (ms: number) => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after ' + ms + 'ms')), ms)
      );

      // 5. RETRY LOGIC: Try up to 3 times with exponential backoff
      let lastError: any;
      let successData: DeliveryCompletionResult | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/3: Calling complete_delivery_safe_wrapper RPC...`);
          
          const rpcCall = supabase.rpc('complete_delivery_safe_wrapper', {
            p_order_id: orderId,
            p_agent_id: agentId,
            p_payment_method: paymentMethod
          });
          
          // Race between RPC call and 10-second timeout
          const { data: rawData, error } = await Promise.race([
            rpcCall,
            timeout(10000)
          ]) as any;
          
          console.log(`📦 Attempt ${attempt}/3 RPC Response:`, { rawData, error });

          if (error) {
            console.error(`❌ Attempt ${attempt}/3 RPC Error:`, {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            lastError = error;
            
            // Retry on network/timeout errors
            if (attempt < 3 && (error.message?.includes('timeout') || error.message?.includes('network'))) {
              const backoffMs = 1000 * attempt;
              console.log(`⏳ Retrying in ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            
            throw error;
          }

          const data = rawData as unknown as DeliveryCompletionResult;

          if (!data?.success) {
            console.error(`❌ Attempt ${attempt}/3 Backend returned failure:`, data?.message);
            lastError = new Error(data?.message || "Backend returned failure");
            
            // Retry on backend failures
            if (attempt < 3) {
              const backoffMs = 1000 * attempt;
              console.log(`⏳ Retrying in ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            
            throw lastError;
          }

          // SUCCESS!
          successData = data;
          console.log("✅ Delivery completed successfully on attempt", attempt, ":", data);
          break; // Exit retry loop

        } catch (err: any) {
          console.error(`❌ Attempt ${attempt}/3 Exception:`, {
            error: err,
            message: err.message,
            stack: err.stack
          });
          lastError = err;
          
          // Retry on exceptions
          if (attempt < 3) {
            const backoffMs = 1000 * attempt;
            console.log(`⏳ Retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
          
          throw err;
        }
      }

      // 6. ONLY SHOW SUCCESS TOAST AFTER BACKEND CONFIRMS
      if (!successData?.success) {
        throw lastError || new Error("All 3 retry attempts failed");
      }

      toast({
        title: "Product successfully delivered",
        description: `Delivery for ${customerName} completed`,
      });

      // Dispatch event for Home page to refresh
      console.log("📡 Dispatching orderCompleted event...");
      window.dispatchEvent(new CustomEvent('orderCompleted', { 
        detail: { orderId, customerName } 
      }));

      // Wait for event to process, then navigate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("🏠 Navigating to home...");
      navigate("/");

    } catch (error: any) {
      console.error("❌ Delivery completion FINAL ERROR:", {
        error,
        message: error.message,
        stack: error.stack,
        details: error.details,
        hint: error.hint
      });

      // Rollback optimistic update - refetch from server
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      toast({
        title: "Failed to update delivery status",
        description: error.message || "Network error. Please check your connection and try again.",
        variant: "destructive",
      });

      // Navigate back on error
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
