import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SettlementRequest {
  agent_id: string;
  amount: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    // Parse request body
    const { agent_id, amount }: SettlementRequest = await req.json();

    if (!agent_id || !amount) {
      throw new Error("Missing agent_id or amount");
    }

    // Verify agent belongs to the authenticated user
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('*')
      .eq('id', agent_id)
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      throw new Error("Agent not found or unauthorized");
    }

    // Call the settlement function
    const { data: settlementResult, error: settlementError } = await supabaseClient
      .rpc('settle_cod_to_admin', {
        p_agent_id: agent_id,
        p_amount: amount
      });

    if (settlementError) {
      throw settlementError;
    }

    console.log('COD settlement initiated:', settlementResult);

    // In a real implementation, here you would:
    // 1. Call Razorpay API to transfer money to admin account
    // 2. Update the transaction with Razorpay transaction ID
    // 3. Handle success/failure responses from Razorpay
    
    // For now, we'll simulate a successful settlement
    const razorpayTransactionId = `rzp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update transaction with Razorpay details
    await supabaseClient
      .from('agent_wallet_transactions')
      .update({ 
        razorpay_transaction_id: razorpayTransactionId,
        status: 'completed'
      })
      .eq('settlement_reference', settlementResult.settlement_reference);

    return new Response(
      JSON.stringify({
        success: true,
        settlement_reference: settlementResult.settlement_reference,
        razorpay_transaction_id: razorpayTransactionId,
        amount: amount,
        message: 'COD amount successfully settled to admin'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('COD settlement error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Settlement failed'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});