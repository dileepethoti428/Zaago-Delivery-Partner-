-- Create function to get agent distance statistics
CREATE OR REPLACE FUNCTION get_agent_distance_stats(agent_uuid uuid)
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
  FROM delivery_history
  WHERE agent_id = agent_uuid
    AND DATE(completed_at) = CURRENT_DATE;

  -- This week's distance
  SELECT COALESCE(SUM(distance_traveled), 0) INTO v_distance_week
  FROM delivery_history
  WHERE agent_id = agent_uuid
    AND completed_at >= date_trunc('week', CURRENT_DATE)
    AND completed_at < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week';

  -- This month's distance
  SELECT COALESCE(SUM(distance_traveled), 0) INTO v_distance_month
  FROM delivery_history
  WHERE agent_id = agent_uuid
    AND completed_at >= date_trunc('month', CURRENT_DATE)
    AND completed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';

  RETURN jsonb_build_object(
    'distance_today', ROUND(COALESCE(v_distance_today, 0), 2),
    'distance_week', ROUND(COALESCE(v_distance_week, 0), 2),
    'distance_month', ROUND(COALESCE(v_distance_month, 0), 2)
  );
END;
$function$;