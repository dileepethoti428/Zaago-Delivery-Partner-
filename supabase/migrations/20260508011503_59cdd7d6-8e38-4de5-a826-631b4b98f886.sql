CREATE OR REPLACE FUNCTION public.get_agent_total_hours(agent_uuid uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed numeric := 0;
  v_active numeric := 0;
BEGIN
  SELECT COALESCE(SUM(total_hours), 0) INTO v_completed
  FROM public.agent_work_sessions
  WHERE agent_id = agent_uuid AND session_end IS NOT NULL;

  SELECT COALESCE(EXTRACT(EPOCH FROM (now() - session_start)) / 3600, 0) INTO v_active
  FROM public.agent_work_sessions
  WHERE agent_id = agent_uuid AND session_end IS NULL
  ORDER BY session_start DESC
  LIMIT 1;

  RETURN ROUND((COALESCE(v_completed, 0) + COALESCE(v_active, 0))::numeric, 4);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_total_hours(uuid) TO authenticated, anon;