import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401
      })
    }

    const { data: agentData } = await supabase
      .from('delivery_agents')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle()

    if (!agentData) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404
      })
    }

    const body = await req.json()
    const { from_date, to_date } = body

    if (!from_date || !to_date) {
      return new Response(JSON.stringify({ error: 'from_date and to_date are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      })
    }

    // to_date: include full day (end of day)
    const toDateEndOfDay = new Date(to_date)
    toDateEndOfDay.setHours(23, 59, 59, 999)

    const { data: records, error: fetchError } = await supabase
      .from('agent_earnings_tracking')
      .select('*')
      .eq('agent_id', agentData.id)
      .gte('accepted_at', from_date)
      .lte('accepted_at', toDateEndOfDay.toISOString())
      .order('accepted_at', { ascending: false })

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch earnings' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
      })
    }

    const rows = records || []

    const pending = rows
      .filter(r => r.payout_status === 'pending')
      .reduce((sum, r) => sum + (parseFloat(r.expected_payout) || 0), 0)

    const confirmed = rows
      .filter(r => r.payout_status === 'confirmed')
      .reduce((sum, r) => sum + (parseFloat(r.actual_payout) || 0), 0)

    const deliveries = rows.filter(r => r.payout_status === 'confirmed').length
    const cancelled = rows.filter(r => r.payout_status === 'cancelled').length
    const inProgress = rows.filter(r => r.payout_status === 'pending').length

    const formattedRecords = rows.map(r => ({
      order_id: r.order_id,
      daily_order_id: r.daily_order_id,
      accepted_at: r.accepted_at,
      completed_at: r.completed_at,
      expected_payout: parseFloat(r.expected_payout || 0),
      actual_payout: r.actual_payout ? parseFloat(r.actual_payout) : null,
      status: r.payout_status,
      distance_km: parseFloat(r.distance_km || 0),
      is_peak_hour: false,
      payout_breakdown: r.payout_breakdown ?? null,
      subscription_id: null,
      order_type: r.order_type || 'regular'
    }))

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          summary: {
            pending: parseFloat(pending.toFixed(2)),
            confirmed: parseFloat(confirmed.toFixed(2)),
            total: parseFloat((pending + confirmed).toFixed(2)),
            deliveries,
            in_progress: inProgress,
            cancelled,
            total_orders: deliveries + inProgress + cancelled
          },
          records: formattedRecords
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
