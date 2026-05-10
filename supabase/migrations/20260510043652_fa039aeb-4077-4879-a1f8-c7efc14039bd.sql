CREATE OR REPLACE FUNCTION public.get_agent_work_hours_breakdown(agent_uuid uuid)
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
  WITH sessions AS (
    SELECT session_start AS s,
           COALESCE(session_end, v_now) AS e
    FROM public.agent_work_sessions
    WHERE agent_id = agent_uuid
  ),
  windows AS (
    SELECT
      GREATEST(0, EXTRACT(EPOCH FROM (LEAST(e, v_today_end) - GREATEST(s, v_today_start))) / 3600.0) AS today_h,
      GREATEST(0, EXTRACT(EPOCH FROM (LEAST(e, v_yesterday_end) - GREATEST(s, v_yesterday_start))) / 3600.0) AS yest_h,
      GREATEST(0, EXTRACT(EPOCH FROM (LEAST(e, v_today_end) - GREATEST(s, v_week_start))) / 3600.0) AS week_h,
      GREATEST(0, EXTRACT(EPOCH FROM (LEAST(e, v_today_end) - GREATEST(s, v_month_start))) / 3600.0) AS month_h,
      EXTRACT(EPOCH FROM (e - s)) / 3600.0 AS all_h
    FROM sessions
  )
  SELECT
    COALESCE(SUM(today_h), 0),
    COALESCE(SUM(yest_h), 0),
    COALESCE(SUM(week_h), 0),
    COALESCE(SUM(month_h), 0),
    COALESCE(SUM(all_h), 0)
  INTO v_today, v_yesterday, v_week, v_month, v_all
  FROM windows;

  RETURN jsonb_build_object(
    'today', ROUND(v_today::numeric, 4),
    'yesterday', ROUND(v_yesterday::numeric, 4),
    'week', ROUND(v_week::numeric, 4),
    'month', ROUND(v_month::numeric, 4),
    'all_time', ROUND(v_all::numeric, 4)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_work_hours_breakdown(uuid) TO authenticated, anon;