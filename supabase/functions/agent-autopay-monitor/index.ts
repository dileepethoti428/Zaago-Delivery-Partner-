import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create service client for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get all agents with autopay enabled and low balance
    const { data: lowBalanceAgents, error: agentsError } = await supabaseService
      .from('agent_autopay_settings')
      .select(`
        *,
        agent_wallet!inner(agent_id, balance),
        delivery_agents!inner(id, name, email, is_active)
      `)
      .eq('is_enabled', true)
      .eq('delivery_agents.is_active', true)
      .lt('agent_wallet.balance', 500); // Balance less than minimum

    if (agentsError) {
      throw agentsError;
    }

    if (!lowBalanceAgents || lowBalanceAgents.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No agents require auto top-up",
          processed: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Razorpay
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    
    let processedCount = 0;
    const errors: string[] = [];

    for (const agentSetting of lowBalanceAgents) {
      try {
        const agentId = agentSetting.agent_id;
        const topupAmount = agentSetting.topup_amount;
        const currentBalance = agentSetting.agent_wallet.balance;

        console.log(`Processing auto top-up for agent ${agentId}: Balance ${currentBalance}, Top-up ${topupAmount}`);

        if (!razorpayKeyId || !razorpayKeySecret) {
          // Simulate the top-up for development
          console.log(`Simulating auto top-up for agent ${agentId}`);
          
          // Update wallet balance
          await supabaseService
            .from('agent_wallet')
            .update({ 
              balance: currentBalance + topupAmount,
              updated_at: new Date().toISOString()
            })
            .eq('agent_id', agentId);

          // Create transaction record
          await supabaseService
            .from('agent_wallet_transactions')
            .insert({
              agent_id: agentId,
              amount: topupAmount,
              transaction_type: 'auto_topup',
              description: `Auto top-up of ₹${topupAmount} (simulated)`,
              status: 'completed'
            });

          processedCount++;
          continue;
        }

        // Create Razorpay order for auto top-up
        const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
        
        const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Authorization": `Basic ${razorpayAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: topupAmount * 100, // Razorpay amount is in paise
            currency: "INR",
            receipt: `auto_topup_${agentId}_${Date.now()}`,
            notes: {
              agent_id: agentId,
              agent_name: agentSetting.delivery_agents.name,
              purpose: "auto_wallet_topup"
            }
          }),
        });

        if (!orderResponse.ok) {
          throw new Error(`Failed to create Razorpay order for agent ${agentId}`);
        }

        const order = await orderResponse.json();

        // For auto top-up, we simulate immediate payment completion
        // In a real scenario, you'd handle the payment flow differently
        
        // Update wallet balance
        await supabaseService
          .from('agent_wallet')
          .update({ 
            balance: currentBalance + topupAmount,
            updated_at: new Date().toISOString()
          })
          .eq('agent_id', agentId);

        // Create transaction record
        await supabaseService
          .from('agent_wallet_transactions')
          .insert({
            agent_id: agentId,
            amount: topupAmount,
            transaction_type: 'auto_topup',
            description: `Auto top-up of ₹${topupAmount}`,
            status: 'completed',
            razorpay_transaction_id: order.id
          });

        processedCount++;

      } catch (error) {
        console.error(`Error processing auto top-up for agent ${agentSetting.agent_id}:`, error);
        errors.push(`Agent ${agentSetting.agent_id}: ${error.message}`);
      }
    }

    // Log the auto-pay processing summary
    await supabaseService
      .from('password_reset_logs') // Using existing log table for audit trail
      .insert({
        email: 'system@zaago.com',
        event_type: 'email_sent',
        metadata: {
          action: 'auto_topup_processing_completed',
          processed_count: processedCount,
          total_agents: lowBalanceAgents.length,
          errors: errors,
          processing_time: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Auto top-up processing completed`,
        processed: processedCount,
        total: lowBalanceAgents.length,
        errors: errors
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in agent-autopay-monitor function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});