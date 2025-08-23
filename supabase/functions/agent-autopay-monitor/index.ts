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
    console.log("Starting autopay monitoring job");
    
    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get all active autopay settings
    const { data: autopaySettings, error: settingsError } = await supabaseService
      .from('agent_autopay_settings')
      .select(`
        *,
        delivery_agents (
          id,
          name,
          email,
          is_active
        )
      `)
      .eq('is_enabled', true);

    if (settingsError) {
      console.error("Error fetching autopay settings:", settingsError);
      throw settingsError;
    }

    if (!autopaySettings || autopaySettings.length === 0) {
      console.log("No active autopay settings found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active autopay settings to process",
          processed: 0
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${autopaySettings.length} active autopay settings`);

    let processedCount = 0;
    let triggeredCount = 0;
    const results = [];

    // Check each agent's wallet balance
    for (const setting of autopaySettings) {
      try {
        processedCount++;
        
        const agentId = setting.agent_id;
        const agent = setting.delivery_agents;
        
        if (!agent || !agent.is_active) {
          console.log(`Skipping inactive agent: ${agentId}`);
          continue;
        }

        console.log(`Checking autopay for agent: ${agent.email} (${agent.name})`);

        // Get current wallet balance
        const { data: wallet, error: walletError } = await supabaseService
          .from('agent_wallet')
          .select('balance, pending_cod_amount')
          .eq('agent_id', agentId)
          .maybeSingle();

        if (walletError) {
          console.error(`Error fetching wallet for agent ${agentId}:`, walletError);
          results.push({
            agent_id: agentId,
            agent_email: agent.email,
            status: 'error',
            message: 'Failed to fetch wallet balance'
          });
          continue;
        }

        if (!wallet) {
          console.log(`No wallet found for agent: ${agentId}`);
          results.push({
            agent_id: agentId,
            agent_email: agent.email,
            status: 'skipped',
            message: 'No wallet found'
          });
          continue;
        }

        const currentBalance = wallet.balance || 0;
        console.log(`Agent ${agent.email} balance: ₹${currentBalance}, threshold: ₹${setting.minimum_balance}`);

        // Check if balance is below threshold
        if (currentBalance < setting.minimum_balance) {
          console.log(`Triggering autopay for ${agent.email}: Balance ₹${currentBalance} < Threshold ₹${setting.minimum_balance}`);
          
          // Check for recent autopay transactions to prevent duplicate charges
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { data: recentTransactions } = await supabaseService
            .from('agent_wallet_transactions')
            .select('id')
            .eq('agent_id', agentId)
            .eq('transaction_type', 'topup')
            .eq('status', 'completed')
            .gte('created_at', oneHourAgo)
            .limit(1);

          if (recentTransactions && recentTransactions.length > 0) {
            console.log(`Skipping autopay for ${agent.email} - recent transaction found`);
            results.push({
              agent_id: agentId,
              agent_email: agent.email,
              status: 'skipped',
              message: 'Recent transaction found, preventing duplicate charge'
            });
            continue;
          }

          // Get Razorpay credentials
          const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
          const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

          if (!razorpayKeyId || !razorpayKeySecret) {
            console.log(`Simulating autopay for ${agent.email} (no Razorpay credentials)`);
            
            // Simulate payment by directly updating wallet
            const newBalance = currentBalance + setting.topup_amount;
            
            // Update wallet balance
            const { error: updateError } = await supabaseService
              .from('agent_wallet')
              .update({
                balance: newBalance,
                updated_at: new Date().toISOString()
              })
              .eq('agent_id', agentId);

            if (updateError) {
              console.error(`Error updating wallet for agent ${agentId}:`, updateError);
              results.push({
                agent_id: agentId,
                agent_email: agent.email,
                status: 'error',
                message: 'Failed to update wallet balance'
              });
              continue;
            }

            // Create transaction record
            const { error: transactionError } = await supabaseService
              .from('agent_wallet_transactions')
              .insert({
                agent_id: agentId,
                amount: setting.topup_amount,
                transaction_type: 'topup',
                description: `Autopay top-up of ₹${setting.topup_amount} (simulated)`,
                status: 'completed'
              });

            if (transactionError) {
              console.error(`Error creating transaction record for agent ${agentId}:`, transactionError);
            }

            triggeredCount++;
            results.push({
              agent_id: agentId,
              agent_email: agent.email,
              status: 'success',
              message: `Autopay triggered (simulated): Added ₹${setting.topup_amount}`,
              old_balance: currentBalance,
              new_balance: newBalance,
              topup_amount: setting.topup_amount
            });

            console.log(`Autopay completed for ${agent.email}: ₹${currentBalance} -> ₹${newBalance}`);
            
          } else {
            // Create Razorpay order for autopay
            console.log(`Creating Razorpay order for autopay: ${agent.email}`);
            const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
            
            const orderPayload = {
              amount: setting.topup_amount * 100, // Razorpay amount is in paise
              currency: "INR",
              receipt: `auto_${agentId.substring(0, 8)}_${Date.now().toString().slice(-8)}`,
              notes: {
                agent_id: agentId,
                agent_name: agent.name,
                purpose: "autopay_topup",
                triggered_at: new Date().toISOString()
              }
            };

            console.log("Razorpay autopay order payload:", orderPayload);
            
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
              console.error(`Razorpay autopay order creation failed for ${agent.email}:`, orderResponse.status, errorText);
              results.push({
                agent_id: agentId,
                agent_email: agent.email,
                status: 'error',
                message: 'Failed to create Razorpay order for autopay'
              });
              continue;
            }

            const order = await orderResponse.json();
            console.log(`Razorpay autopay order created for ${agent.email}:`, order.id);

            // Create pending transaction record
            const { error: transactionError } = await supabaseService
              .from('agent_wallet_transactions')
              .insert({
                agent_id: agentId,
                amount: setting.topup_amount,
                transaction_type: 'topup',
                description: `Autopay top-up of ₹${setting.topup_amount}`,
                status: 'pending',
                razorpay_transaction_id: order.id
              });

            if (transactionError) {
              console.error(`Error creating transaction record for agent ${agentId}:`, transactionError);
            }

            triggeredCount++;
            results.push({
              agent_id: agentId,
              agent_email: agent.email,
              status: 'pending',
              message: `Autopay order created: ₹${setting.topup_amount}`,
              razorpay_order_id: order.id,
              current_balance: currentBalance,
              topup_amount: setting.topup_amount
            });

            console.log(`Autopay order created for ${agent.email}: ₹${setting.topup_amount}`);
          }
          
        } else {
          console.log(`No autopay needed for ${agent.email}: Balance ₹${currentBalance} >= Threshold ₹${setting.minimum_balance}`);
          results.push({
            agent_id: agentId,
            agent_email: agent.email,
            status: 'sufficient_balance',
            message: 'Balance above threshold',
            current_balance: currentBalance,
            threshold: setting.minimum_balance
          });
        }

      } catch (error) {
        console.error(`Error processing autopay for agent ${setting.agent_id}:`, error);
        results.push({
          agent_id: setting.agent_id,
          status: 'error',
          message: error.message
        });
      }
    }

    console.log(`Autopay monitoring completed: ${processedCount} processed, ${triggeredCount} triggered`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Autopay monitoring completed successfully`,
        processed_count: processedCount,
        triggered_count: triggeredCount,
        results: results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in autopay monitoring function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: "Failed to process autopay monitoring"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});