-- Drop and recreate the calculate_delivery_payout function with proper JSON handling
DROP FUNCTION IF EXISTS public.calculate_delivery_payout(numeric, timestamp with time zone, uuid);

CREATE OR REPLACE FUNCTION public.calculate_delivery_payout(
  p_distance_km numeric DEFAULT 0, 
  p_delivery_time timestamp with time zone DEFAULT now(), 
  p_agent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_rate numeric := 12;           -- Base payout per delivery
  per_km_rate numeric := 5;          -- Rate per km after first km
  peak_multiplier numeric := 1.0;    -- Peak hour multiplier
  peak_bonus numeric := 0;           -- Peak hour bonus amount
  distance_amount numeric := 0;      -- Distance-based amount
  total_payout numeric := 0;         -- Final total payout
  is_peak_hour boolean := false;     -- Whether it's peak hour
BEGIN
  -- Ensure distance is not negative and has reasonable bounds
  p_distance_km := GREATEST(0, LEAST(p_distance_km, 100)); -- Max 100km limit
  
  -- Check if it's peak hour (6-9 AM or 6-9 PM)
  is_peak_hour := EXTRACT(HOUR FROM p_delivery_time) BETWEEN 6 AND 9 
                  OR EXTRACT(HOUR FROM p_delivery_time) BETWEEN 18 AND 21;
  
  -- Calculate distance-based amount (first km is free, then per_km_rate for additional)
  IF p_distance_km > 1 THEN
    distance_amount := (p_distance_km - 1) * per_km_rate;
  END IF;
  
  -- Calculate base total
  total_payout := base_rate + distance_amount;
  
  -- Apply peak hour bonus
  IF is_peak_hour THEN
    peak_multiplier := 1.5;
    peak_bonus := total_payout * 0.5; -- 50% bonus during peak hours
    total_payout := total_payout * peak_multiplier;
  END IF;
  
  -- Ensure minimum payout
  total_payout := GREATEST(total_payout, base_rate);
  
  -- Round to 2 decimal places
  total_payout := ROUND(total_payout, 2);
  peak_bonus := ROUND(peak_bonus, 2);
  distance_amount := ROUND(distance_amount, 2);
  
  -- Return proper JSON structure
  RETURN jsonb_build_object(
    'success', true,
    'total_payout', total_payout,
    'base_rate', base_rate,
    'distance_km', p_distance_km,
    'distance_amount', distance_amount,
    'peak_bonus', peak_bonus,
    'peak_multiplier', peak_multiplier,
    'is_peak_hour', is_peak_hour,
    'delivery_time', p_delivery_time,
    'agent_id', p_agent_id,
    'calculation_details', jsonb_build_object(
      'per_km_rate', per_km_rate,
      'minimum_payout', base_rate,
      'peak_hours', '6-9 AM, 6-9 PM'
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Fallback in case of any error - return safe default values
  RETURN jsonb_build_object(
    'success', true,
    'total_payout', base_rate,
    'base_rate', base_rate,
    'distance_km', COALESCE(p_distance_km, 0),
    'distance_amount', 0,
    'peak_bonus', 0,
    'peak_multiplier', 1.0,
    'is_peak_hour', false,
    'delivery_time', COALESCE(p_delivery_time, now()),
    'agent_id', p_agent_id,
    'error_handled', true,
    'error_message', SQLERRM
  );
END;
$function$;