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

    // Get all completed deliveries that need reconciliation
    const { data: completions, error: fetchError } = await supabase
      .from('delivery_completions')
      .select('*')
      .eq('status', 'completed');

    if (fetchError) {
      console.error('❌ Error fetching completions:', fetchError);
      throw fetchError;
    }

    console.log(`📋 Found ${completions?.length || 0} completions to reconcile`);

    let successCount = 0;
    let errorCount = 0;

    // Process each completion
    for (const completion of completions || []) {
      try {
        // Update order status to delivered
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString(),
            payment_status: completion.payment_method === 'COD' ? 'paid_cod' : 'paid_online',
            updated_at: new Date().toISOString()
          })
          .eq('id', completion.order_id)
          .in('status', ['assigned', 'out_for_delivery']);

        if (updateError) {
          console.error(`❌ Error updating order ${completion.order_id}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Order ${completion.order_id} status updated to delivered`);
          successCount++;
        }

        // Mark completion as reconciled
        const { error: completionError } = await supabase
          .from('delivery_completions')
          .update({ 
            status: 'reconciled',
            metadata: {
              ...completion.metadata,
              reconciled_at: new Date().toISOString(),
              reconciled_by: 'auto-reconciliation'
            }
          })
          .eq('id', completion.id);

        if (completionError) {
          console.error(`❌ Error updating completion ${completion.id}:`, completionError);
        } else {
          console.log(`✅ Completion ${completion.id} marked as reconciled`);
        }

      } catch (error) {
        console.error(`💥 Error processing completion ${completion.id}:`, error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Orders reconciled successfully',
        processed_count: successCount + errorCount,
        success_count: successCount,
        error_count: errorCount
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