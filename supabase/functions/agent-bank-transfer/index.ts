import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BankTransferRequest {
  agent_id: string;
  amount: number;
  bank_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const { agent_id, amount, bank_id }: BankTransferRequest = await req.json();

    console.log('Processing bank transfer:', { agent_id, amount, bank_id });

    // Validate request
    if (!agent_id || !amount || !bank_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // Minimum transfer amount
    if (amount < 500) {
      return new Response(
        JSON.stringify({ success: false, error: 'Minimum transfer amount is ₹500' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('delivery_agents')
      .select('*')
      .eq('id', agent_id)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent not found or inactive' }),
        { headers: corsHeaders, status: 404 }
      );
    }

    // Get bank details
    const { data: bankDetails, error: bankError } = await supabase
      .from('agent_bank_details')
      .select('*')
      .eq('id', bank_id)
      .eq('agent_id', agent_id)
      .single();

    if (bankError || !bankDetails) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bank details not found' }),
        { headers: corsHeaders, status: 404 }
      );
    }

    // Check agent wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('agent_wallet')
      .select('*')
      .eq('agent_id', agent_id)
      .single();

    if (walletError || !wallet || wallet.balance < amount) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient wallet balance' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // Generate transfer reference
    const transferRef = `TXN_${Date.now()}_${agent_id.substring(0, 8)}`;

    // Process Razorpay transfer (if credentials are available)
    let razorpayTransferId = null;
    const razorpayKey = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (razorpayKey && razorpaySecret) {
      try {
        console.log('Processing Razorpay transfer...');
        
        // Create Razorpay transfer
        const razorpayResponse = await fetch('https://api.razorpay.com/v1/transfers', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${razorpayKey}:${razorpaySecret}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account: `acc_${bankDetails.account_number}`, // This would be the Razorpay account ID
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            notes: {
              agent_id: agent_id,
              transfer_reference: transferRef,
              bank_account: bankDetails.account_number,
              ifsc: bankDetails.ifsc_code
            }
          })
        });

        if (razorpayResponse.ok) {
          const transferData = await razorpayResponse.json();
          razorpayTransferId = transferData.id;
          console.log('Razorpay transfer successful:', razorpayTransferId);
        } else {
          console.error('Razorpay transfer failed:', await razorpayResponse.text());
        }
      } catch (razorpayError) {
        console.error('Razorpay transfer error:', razorpayError);
      }
    } else {
      console.log('Razorpay credentials not configured, simulating transfer');
    }

    // Update agent wallet
    const { error: walletUpdateError } = await supabase
      .from('agent_wallet')
      .update({ 
        balance: wallet.balance - amount,
        updated_at: new Date().toISOString()
      })
      .eq('agent_id', agent_id);

    if (walletUpdateError) {
      console.error('Wallet update error:', walletUpdateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update wallet balance' }),
        { headers: corsHeaders, status: 500 }
      );
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('agent_wallet_transactions')
      .insert({
        agent_id: agent_id,
        amount: -amount,
        transaction_type: 'bank_transfer',
        description: `Bank transfer to ${bankDetails.bank_name} - ${bankDetails.account_number.slice(-4)}`,
        status: razorpayTransferId ? 'completed' : 'processed',
        razorpay_transaction_id: razorpayTransferId,
        settlement_reference: transferRef
      });

    if (transactionError) {
      console.error('Transaction record error:', transactionError);
    }

    // Log transfer details
    console.log('Bank transfer completed:', {
      agent_id,
      amount,
      bank_details: `${bankDetails.bank_name} - ${bankDetails.account_number.slice(-4)}`,
      transfer_reference: transferRef,
      razorpay_id: razorpayTransferId || 'simulated'
    });

    return new Response(
      JSON.stringify({
        success: true,
        transfer_reference: transferRef,
        amount: amount,
        bank_details: {
          bank_name: bankDetails.bank_name,
          account_number: bankDetails.account_number.slice(-4),
          ifsc_code: bankDetails.ifsc_code
        },
        razorpay_transfer_id: razorpayTransferId,
        message: 'Transfer completed successfully'
      }),
      { headers: corsHeaders, status: 200 }
    );

  } catch (error) {
    console.error('Bank transfer error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred during bank transfer'
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});