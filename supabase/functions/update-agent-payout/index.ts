import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { bank_account_name, bank_account_number, ifsc_code, upi_id, bank_name } = body;

    // Validation
    if (!bank_account_name || bank_account_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Account holder name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!bank_account_number || bank_account_number.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Account number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Basic IFSC validation: 4 letters + 0 + 6 alphanumeric
    if (ifsc_code) {
      const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscPattern.test(ifsc_code)) {
        return new Response(JSON.stringify({ error: 'Invalid IFSC code format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Basic UPI validation
    if (upi_id) {
      const upiPattern = /^[\w.-]+@[\w.-]+$/;
      if (!upiPattern.test(upi_id)) {
        return new Response(JSON.stringify({ error: 'Invalid UPI ID format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Updating bank details for agent:', user.id);

    // Get agent ID
    const { data: agent } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('agent_id', user.id)
      .single();

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert bank details
    const bankData: any = {
      agent_id: agent.id,
      account_holder_name: bank_account_name,
      account_number: bank_account_number,
      ifsc_code: ifsc_code || null,
      bank_name: bank_name || null,
      upi_id: upi_id || null,
      is_primary: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('agent_bank_details')
      .upsert(bankData, { onConflict: 'agent_id' })
      .select()
      .single();

    if (error) {
      console.error('Bank details update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update bank details' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Bank details updated successfully');

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
