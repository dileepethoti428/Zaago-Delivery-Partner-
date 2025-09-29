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
    console.log('🔄 Starting order completion reconciliation');

    // Initialize Supabase with service role for elevated permissions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all unreconciled completions
    const { data: completions, error: completionsError } = await supabase
      .from('delivery_completions')
      .select('*')
      .eq('status', 'completed');

    if (completionsError) {
      console.error('❌ Error fetching completions:', completionsError);
      throw completionsError;
    }

    console.log(`📋 Found ${completions?.length || 0} completed deliveries to reconcile`);

    let reconciledCount = 0;
    let errorCount = 0;

    for (const completion of completions || []) {
      try {
        console.log(`🔄 Reconciling order: ${completion.order_id}`);

        // Update orders table status without triggering problematic triggers
        // Use a direct SQL update that bypasses ORM triggers
        const updateSQL = `
          UPDATE public.orders 
          SET 
            status = 'delivered',
            delivered_at = $1,
            payment_status = CASE 
              WHEN $2 = 'COD' THEN 'paid_cod' 
              ELSE 'paid_online' 
            END,
            updated_at = NOW()
          WHERE id = $3
          AND status != 'delivered'
        `;

        const { error: updateError } = await supabase.rpc('execute_sql', {
          query: updateSQL,
          parameters: [
            completion.completed_at,
            completion.payment_method,
            completion.order_id
          ]
        });

        if (updateError) {
          console.error(`❌ Failed to update order ${completion.order_id}:`, updateError);
          errorCount++;
          continue;
        }

        // Mark completion as reconciled
        await supabase
          .from('delivery_completions')
          .update({ 
            status: 'reconciled',
            metadata: {
              ...completion.metadata,
              reconciled_at: new Date().toISOString()
            }
          })
          .eq('id', completion.id);

        console.log(`✅ Successfully reconciled order: ${completion.order_id}`);
        reconciledCount++;

      } catch (error) {
        console.error(`❌ Error reconciling order ${completion.order_id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Reconciliation complete: ${reconciledCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        reconciled_count: reconciledCount,
        error_count: errorCount,
        total_processed: completions?.length || 0
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