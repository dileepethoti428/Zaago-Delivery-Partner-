import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔧 Starting retroactive fix for pending deliveries...');

    // Find all tracking records that are pending but order is delivered
    const { data: pendingTracking, error: fetchError } = await supabase
      .from('agent_earnings_tracking')
      .select(`
        *,
        orders!inner(status, payment_status, delivered_at)
      `)
      .eq('payout_status', 'pending')
      .eq('orders.status', 'delivered');

    if (fetchError) {
      console.error('❌ Failed to fetch pending tracking:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Found ${pendingTracking?.length || 0} pending records with delivered orders`);

    let fixed = 0;
    let failed = 0;
    const errors = [];

    for (const tracking of pendingTracking || []) {
      try {
        console.log(`Processing tracking record ${tracking.id} for order ${tracking.order_id}...`);
        
        // Get payout from delivery_history
        const { data: history, error: historyError } = await supabase
          .from('delivery_history')
          .select('delivery_payout, completed_at, distance_traveled')
          .eq('order_id', tracking.order_id)
          .eq('agent_id', tracking.agent_id)
          .single();

        if (historyError) {
          console.error(`⚠️ No delivery history found for order ${tracking.order_id}`);
          // Use estimated payout based on distance
          const estimatedDistance = tracking.distance_km || 2.5;
          const estimatedPayout = estimatedDistance <= 1 ? 25 : 25 + (estimatedDistance - 1) * 8;
          
          const { error: updateError } = await supabase
            .from('agent_earnings_tracking')
            .update({
              payout_status: 'confirmed',
              actual_payout: Math.round(estimatedPayout),
              completed_at: tracking.orders.delivered_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', tracking.id);

          if (updateError) {
            console.error(`❌ Failed to fix tracking ${tracking.id}:`, updateError);
            errors.push({ order_id: tracking.order_id, error: updateError.message });
            failed++;
          } else {
            console.log(`✅ Fixed tracking for order ${tracking.order_id} (using estimate)`);
            fixed++;
          }
          continue;
        }

        // Update with actual delivery history data
        const { error: updateError } = await supabase
          .from('agent_earnings_tracking')
          .update({
            payout_status: 'confirmed',
            actual_payout: history.delivery_payout,
            completed_at: history.completed_at,
            distance_km: history.distance_traveled || tracking.distance_km,
            updated_at: new Date().toISOString()
          })
          .eq('id', tracking.id);

        if (updateError) {
          console.error(`❌ Failed to fix tracking ${tracking.id}:`, updateError);
          errors.push({ order_id: tracking.order_id, error: updateError.message });
          failed++;
        } else {
          console.log(`✅ Fixed tracking for order ${tracking.order_id} (actual: ₹${history.delivery_payout})`);
          fixed++;
        }
      } catch (err) {
        console.error(`❌ Error processing tracking ${tracking.id}:`, err);
        errors.push({ 
          order_id: tracking.order_id, 
          error: err instanceof Error ? err.message : String(err) 
        });
        failed++;
      }
    }

    const summary = {
      success: true,
      message: `Fixed ${fixed} records, ${failed} failed`,
      fixed,
      failed,
      total: pendingTracking?.length || 0,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('✅ Retroactive fix complete:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fix pending deliveries error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
