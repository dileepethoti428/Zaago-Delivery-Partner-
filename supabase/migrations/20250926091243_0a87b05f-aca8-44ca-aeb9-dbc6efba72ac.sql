-- Fix the broken calculate_delivery_payout function
-- The function was cut off and causing JSON syntax errors

CREATE OR REPLACE FUNCTION public.calculate_delivery_payout(distance_km numeric, delivery_time timestamp with time zone DEFAULT now(), agent_id_param uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  config RECORD;
  base_amount NUMERIC := 0;
  distance_amount NUMERIC := 0;
  total_payout NUMERIC := 0;
  per_km_rate NUMERIC;
  delivery_hour TIME;
  is_peak_hour BOOLEAN := false;
  daily_orders INTEGER := 0;
  peak_bonus NUMERIC := 0;
  result JSONB;
BEGIN
  -- Get active payout configuration
  SELECT * INTO config FROM payout_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1;
  
  IF NOT FOUND THEN
    -- Use default values if no config found
    config.base_pay_amount := 15.00;
    config.base_pay_distance_km := 1.0;
    config.per_km_min_rate := 10.00;
    config.per_km_max_rate := 14.00;
    config.peak_hour_start := '06:00:00';
    config.peak_hour_end := '12:00:00';
    config.peak_hour_order_threshold := 14;
    config.peak_hour_bonus_amount := 80.00;
  END IF;
  
  -- Calculate base pay
  base_amount := config.base_pay_amount;
  
  -- Calculate distance-based pay
  IF distance_km > config.base_pay_distance_km THEN
    -- Use average rate for now (could be dynamic based on demand, time, etc.)
    per_km_rate := (config.per_km_min_rate + config.per_km_max_rate) / 2;
    distance_amount := (distance_km - config.base_pay_distance_km) * per_km_rate;
  END IF;
  
  -- Check if delivery is during peak hours
  delivery_hour := delivery_time::TIME;
  is_peak_hour := delivery_hour >= config.peak_hour_start AND delivery_hour <= config.peak_hour_end;
  
  -- Calculate peak hour bonus if applicable
  IF is_peak_hour AND agent_id_param IS NOT NULL THEN
    -- Count deliveries today for this agent
    SELECT COUNT(*) INTO daily_orders
    FROM delivery_history dh
    WHERE dh.agent_id = agent_id_param
    AND dh.delivery_date = CURRENT_DATE;
    
    -- Award bonus if agent has completed enough deliveries today
    IF daily_orders >= config.peak_hour_order_threshold THEN
      peak_bonus := config.peak_hour_bonus_amount;
    END IF;
  END IF;
  
  -- Calculate total payout
  total_payout := base_amount + distance_amount + peak_bonus;
  
  -- Build result JSON
  result := jsonb_build_object(
    'base_amount', base_amount,
    'distance_amount', distance_amount,
    'peak_bonus', peak_bonus,
    'total_payout', total_payout,
    'distance_km', distance_km,
    'is_peak_hour', is_peak_hour,
    'daily_orders', daily_orders,
    'per_km_rate', COALESCE(per_km_rate, 0)
  );
  
  RETURN result;
END;
$function$;