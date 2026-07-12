CREATE OR REPLACE FUNCTION public.update_agent_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision DEFAULT NULL,
  p_heading double precision DEFAULT NULL,
  p_speed double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_agent record;
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_auth');
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_coordinates');
  END IF;

  SELECT id, is_active, name INTO v_agent
  FROM public.delivery_agents
  WHERE agent_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'agent_not_found');
  END IF;

  IF v_agent.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'reason', 'agent_inactive');
  END IF;

  UPDATE public.delivery_agents
  SET latitude = p_latitude,
      longitude = p_longitude,
      is_online = true,
      last_location_updated_at = v_now
  WHERE id = v_agent.id;

  BEGIN
    INSERT INTO public.driver_locations
      (agent_id, latitude, longitude, accuracy, heading, speed, is_active, recorded_at)
    VALUES
      (v_agent.id, p_latitude, p_longitude, p_accuracy, p_heading, p_speed, true, v_now);
  EXCEPTION WHEN OTHERS THEN
    -- history is secondary; don't fail the RPC
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'agent_id', v_agent.id,
    'latitude', p_latitude,
    'longitude', p_longitude,
    'timestamp', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_agent_location(double precision, double precision, double precision, double precision, double precision) TO authenticated;