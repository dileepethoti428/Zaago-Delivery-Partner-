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
    console.log("Agent topup request started");
    
    // Create Supabase client using the anon key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !data.user?.email) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ error: "User not authenticated" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const user = data.user;
    console.log("User authenticated:", user.email);

    // Get request body
    const body = await req.json();
    const { amount }: TopupRequest = body;

    // Validate minimum top-up amount
    if (!amount || amount < 500) {
      console.error("Invalid amount:", amount);
      return new Response(
        JSON.stringify({ error: "Minimum top-up amount is ₹500" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Amount validated:", amount);

    // Get agent details using service client for reliable access
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    console.log("Looking up agent for email:", user.email);
    const { data: agent, error: agentError } = await supabaseService
      .from('delivery_agents')
      .select('id, name, email')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();

    if (agentError) {
      console.error("Agent lookup error:", agentError);
      return new Response(
        JSON.stringify({ error: "Error finding agent profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!agent) {
      console.error("No active agent found for email:", user.email);
      return new Response(
        JSON.stringify({ error: "Agent profile not found or inactive. Please contact support." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Agent found:", agent.id, agent.name);

    // Initialize Razorpay (using environment variables)
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    console.log("Razorpay credentials check:", { 
      keyId: razorpayKeyId ? "present" : "missing", 
      keySecret: razorpayKeySecret ? "present" : "missing" 
    });

    if (!razorpayKeyId || !razorpayKeySecret) {
      // Fallback: Simulate payment for development
      console.log("Razorpay credentials not configured, simulating payment");
      
      // Get current wallet balance first
      const { data: currentWallet, error: walletError } = await supabaseService
        .from('agent_wallet')
        .select('balance')
        .eq('agent_id', agent.id)
        .maybeSingle();

      if (walletError) {
        console.error("Wallet lookup error:", walletError);
        return new Response(
          JSON.stringify({ error: "Error accessing wallet" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const currentBalance = currentWallet?.balance || 0;
      const newBalance = currentBalance + amount;

      console.log("Simulated payment - updating wallet:", { currentBalance, amount, newBalance });

      // Update wallet balance
      const { error: updateError } = await supabaseService
        .from('agent_wallet')
        .upsert({
          agent_id: agent.id,
          balance: newBalance,
          updated_at: new Date().toISOString()
        });

      if (updateError) {
        console.error("Wallet update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Error updating wallet balance" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create transaction record
      const { error: transactionError } = await supabaseService
        .from('agent_wallet_transactions')
        .insert({
          agent_id: agent.id,
          amount: amount,
          transaction_type: 'topup',
          description: `Wallet top-up of ₹${amount} (simulated)`,
          status: 'completed'
        });

      if (transactionError) {
        console.error("Transaction record error:", transactionError);
        // Don't fail the whole operation for this
      }

      console.log("Simulated payment completed successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Top-up completed (simulated)",
          amount: amount,
          new_balance: newBalance
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Razorpay order
    console.log("Creating Razorpay order for amount:", amount);
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    
    const orderPayload = {
      amount: amount * 100, // Razorpay amount is in paise
      currency: "INR",
      receipt: `topup_${agent.id}_${Date.now()}`,
      notes: {
        agent_id: agent.id,
        agent_name: agent.name,
        purpose: "wallet_topup"
      }
    };

    console.log("Razorpay order payload:", orderPayload);
    
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${razorpayAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("Razorpay order creation failed:", orderResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create payment order. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const order = await orderResponse.json();
    console.log("Razorpay order created successfully:", order.id);

    // Create pending transaction record
    const { error: transactionError } = await supabaseService
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent.id,
        amount: amount,
        transaction_type: 'topup',
        description: `Wallet top-up of ₹${amount}`,
        status: 'pending',
        razorpay_transaction_id: order.id
      });

    if (transactionError) {
      console.error("Error creating transaction record:", transactionError);
      // Continue with order creation even if transaction record fails
    }

    console.log("Returning Razorpay order details");

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