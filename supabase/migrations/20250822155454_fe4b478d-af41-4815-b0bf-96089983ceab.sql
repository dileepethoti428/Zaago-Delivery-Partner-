-- Create function to get agent distance statistics
CREATE OR REPLACE FUNCTION public.get_agent_distance_stats(agent_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_distance_today numeric := 0;
  v_distance_week numeric := 0;
  v_distance_month numeric := 0;
BEGIN
  -- Today's distance
  SELECT COALESCE(SUM(distance_traveled), 0) INTO v_distance_today
  FROM public.delivery_history
  WHERE agent_id = agent_uuid
    AND DATE(completed_at) = CURRENT_DATE;

  -- This week's distance
  SELECT COALESCE(SUM(distance_traveled), 0) INTO v_distance_week
  FROM public.delivery_history
  WHERE agent_id = agent_uuid
    AND completed_at >= date_trunc('week', CURRENT_DATE);

  -- This month's distance
  SELECT COALESCE(SUM(distance_traveled), 0) INTO v_distance_month
  FROM public.delivery_history
  WHERE agent_id = agent_uuid
    AND completed_at >= date_trunc('month', CURRENT_DATE);

  RETURN jsonb_build_object(
    'distance_today', COALESCE(v_distance_today, 0),
    'distance_week', COALESCE(v_distance_week, 0),
    'distance_month', COALESCE(v_distance_month, 0)
  );
END;
$function$

-- Create function to get agent hours worked today
CREATE OR REPLACE FUNCTION public.get_agent_hours_today(agent_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hours_today numeric := 0;
  v_current_session_hours numeric := 0;
BEGIN
  -- Get completed work sessions for today
  SELECT COALESCE(SUM(total_hours), 0) INTO v_hours_today
  FROM public.agent_work_sessions
  WHERE agent_id = agent_uuid
    AND DATE(session_start) = CURRENT_DATE
    AND session_end IS NOT NULL;

  -- Add current active session if exists
  SELECT COALESCE(EXTRACT(EPOCH FROM (now() - session_start)) / 3600, 0) INTO v_current_session_hours
  FROM public.agent_work_sessions
  WHERE agent_id = agent_uuid
    AND session_end IS NULL
    AND DATE(session_start) = CURRENT_DATE
  ORDER BY session_start DESC
  LIMIT 1;

  RETURN COALESCE(v_hours_today, 0) + COALESCE(v_current_session_hours, 0);
END;
$function$