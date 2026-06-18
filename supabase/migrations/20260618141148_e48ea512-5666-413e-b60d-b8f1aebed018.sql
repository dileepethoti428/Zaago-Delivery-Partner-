CREATE OR REPLACE FUNCTION public.get_agent_distance_breakdown(agent_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz text := 'Asia/Kolkata';
  v_now timestamptz := now();
  v_today_start timestamptz := (date_trunc('day', v_now AT TIME ZONE v_tz)) AT TIME ZONE v_tz;
  v_today_end timestamptz := v_today_start + interval '1 day';
  v_yesterday_start timestamptz := v_today_start - interval '1 day';
  v_yesterday_end timestamptz := v_today_start;
  v_week_start timestamptz := v_today_end - interval '7 days';
  v_month_start timestamptz := v_today_end - interval '30 days';

  v_today numeric := 0;
  v_yesterday numeric := 0;
  v_week numeric := 0;
  v_month numeric := 0;
  v_all numeric := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN created_at >= v_today_start AND created_at < v_today_end THEN distance_km ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN created_at >= v_yesterday_start AND created_at < v_yesterday_end THEN distance_km ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN created_at >= v_week_start AND created_at < v_today_end THEN distance_km ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN created_at >= v_month_start AND created_at < v_today_end THEN distance_km ELSE 0 END), 0),
    COALESCE(SUM(distance_km), 0)
  INTO v_today, v_yesterday, v_week, v_month, v_all
  FROM public.agent_earnings_tracking
  WHERE agent_id = agent_uuid
    AND payout_status IN ('confirmed', 'pending');

  RETURN jsonb_build_object(
    'today', ROUND(v_today::numeric, 2),
    'yesterday', ROUND(v_yesterday::numeric, 2),
    'week', ROUND(v_week::numeric, 2),
    'month', ROUND(v_month::numeric, 2),
    'all_time', ROUND(v_all::numeric, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_distance_breakdown(uuid) TO authenticated, anon;