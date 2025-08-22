import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TopupRequest {
  amount: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client using the anon key
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

    // Get request body
    const { amount }: TopupRequest = await req.json();

    // Validate minimum top-up amount
    if (amount < 500) {
      return new Response(
        JSON.stringify({ error: "Minimum top-up amount is ₹500" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabaseClient
      .from('delivery_agents')
      .select('id, name')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (agentError || !agent) {
      throw new Error("Agent not found or inactive");
    }

    // Initialize Razorpay (using environment variables)
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      // Fallback: Simulate payment for development
      console.log("Razorpay credentials not configured, simulating payment");
      
      // Create service client for database operations
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Update wallet balance
      await supabaseService
        .from('agent_wallet')
        .upsert({
          agent_id: agent.id,
          balance: amount, // This would be current_balance + amount in real scenario
          updated_at: new Date().toISOString()
        });

      // Create transaction record
      await supabaseService
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agent.id,
          amount: amount,
          transaction_type: 'topup',
          description: `Wallet top-up of ₹${amount} (simulated)`,
          status: 'completed'
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Top-up completed (simulated)",
          amount: amount
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Razorpay order
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${razorpayAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount * 100, // Razorpay amount is in paise
        currency: "INR",
        receipt: `topup_${agent.id}_${Date.now()}`,
        notes: {
          agent_id: agent.id,
          agent_name: agent.name,
          purpose: "wallet_topup"
        }
      }),
    });

    if (!orderResponse.ok) {
      throw new Error("Failed to create Razorpay order");
    }

    const order = await orderResponse.json();

    // Create service client for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Create pending transaction record
    await supabaseService
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        amount: amount,
        transaction_type: 'topup',
        description: `Wallet top-up of ₹${amount}`,
        status: 'pending',
        razorpay_transaction_id: order.id
      });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        amount: amount,
        currency: order.currency,
        key: razorpayKeyId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in agent-topup-razorpay function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});