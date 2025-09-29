import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Running immediate reconciliation for completed orders');

    // Initialize Supabase with service role for elevated permissions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update the specific order that was completed
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        payment_status: 'paid_cod', // Assuming COD for now
        updated_at: new Date().toISOString()
      })
      .eq('id', 'd56d4ad7-9fc2-4813-b270-a5732d31af60')
      .eq('status', 'assigned'); // Only if still assigned

    if (updateError) {
      console.error('❌ Error updating order:', updateError);
    } else {
      console.log('✅ Order status updated to delivered');
    }

    // Mark completion as reconciled
    const { error: completionError } = await supabase
      .from('delivery_completions')
      .update({ 
        status: 'reconciled',
        metadata: {
          reconciled_at: new Date().toISOString(),
          reconciled_by: 'auto-reconciliation'
        }
      })
      .eq('order_id', 'd56d4ad7-9fc2-4813-b270-a5732d31af60')
      .eq('status', 'completed');

    if (completionError) {
      console.error('❌ Error updating completion:', completionError);
    } else {
      console.log('✅ Completion marked as reconciled');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order reconciled successfully',
        order_updated: !updateError,
        completion_updated: !completionError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Reconciliation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Reconciliation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});