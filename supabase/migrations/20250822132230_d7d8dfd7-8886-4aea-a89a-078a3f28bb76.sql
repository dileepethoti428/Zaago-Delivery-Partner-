-- Update agent payout system with new structure
-- Base Pay: ₹15 for orders within 1 km
-- Per Kilometer: ₹10-₹14 per km for distances over 1 km
-- Peak Hour Incentives: Extra ₹80 for 14 orders during 6 AM to 12 PM

-- Create payout configuration table
CREATE TABLE IF NOT EXISTS payout_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_pay_amount NUMERIC DEFAULT 15.00,
  base_pay_distance_km NUMERIC DEFAULT 1.0,
  per_km_min_rate NUMERIC DEFAULT 10.00,
  per_km_max_rate NUMERIC DEFAULT 14.00,
  peak_hour_start TIME DEFAULT '06:00:00',
  peak_hour_end TIME DEFAULT '12:00:00',
  peak_hour_order_threshold INTEGER DEFAULT 14,
  peak_hour_bonus_amount NUMERIC DEFAULT 80.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Insert default configuration
INSERT INTO payout_config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- Create function to calculate delivery payout
CREATE OR REPLACE FUNCTION calculate_delivery_payout(
  distance_km NUMERIC,
  delivery_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  agent_id_param UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
    -- Count today's deliveries during peak hours for this agent
    SELECT COUNT(*) INTO daily_orders
    FROM delivery_history dh
    WHERE dh.agent_id = agent_id_param
      AND DATE(dh.completed_at) = DATE(delivery_time)
      AND dh.completed_at::TIME >= config.peak_hour_start
      AND dh.completed_at::TIME <= config.peak_hour_end;
    
    -- Add 1 for current delivery
    daily_orders := daily_orders + 1;
    
    -- Check if threshold is met for bonus
    IF daily_orders >= config.peak_hour_order_threshold THEN
      -- Check if bonus hasn't been awarded today
      IF NOT EXISTS (
        SELECT 1 FROM agent_wallet_transactions awt
        WHERE awt.agent_id = agent_id_param
          AND awt.transaction_type = 'peak_bonus'
          AND DATE(awt.created_at) = DATE(delivery_time)
      ) THEN
        peak_bonus := config.peak_hour_bonus_amount;
      END IF;
    END IF;
  END IF;
  
  total_payout := base_amount + distance_amount + peak_bonus;
  
  -- Build result JSON
  result := jsonb_build_object(
    'base_pay', base_amount,
    'distance_pay', distance_amount,
    'peak_bonus', peak_bonus,
    'total_payout', total_payout,
    'distance_km', distance_km,
    'is_peak_hour', is_peak_hour,
    'peak_orders_today', COALESCE(daily_orders, 0),
    'per_km_rate', COALESCE(per_km_rate, 0),
    'breakdown', jsonb_build_object(
      'base_pay_description', 'Base pay for delivery within ' || config.base_pay_distance_km || ' km',
      'distance_pay_description', CASE 
        WHEN distance_km > config.base_pay_distance_km 
        THEN 'Additional ' || ROUND((distance_km - config.base_pay_distance_km), 2) || ' km @ ₹' || COALESCE(per_km_rate, 0) || '/km'
        ELSE 'No additional distance charge'
      END,
      'peak_bonus_description', CASE 
        WHEN peak_bonus > 0 
        THEN 'Peak hour bonus for ' || config.peak_hour_order_threshold || ' orders during ' || config.peak_hour_start || '-' || config.peak_hour_end
        ELSE 'No peak hour bonus'
      END
    )
  );
  
  RETURN result;
END;
$$;

-- Create function to process delivery payout
CREATE OR REPLACE FUNCTION process_delivery_payout(
  p_agent_id UUID,
  p_order_id UUID,
  p_distance_km NUMERIC,
  p_delivery_time TIMESTAMP WITH TIME ZONE DEFAULT now()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  payout_calc JSONB;
  total_amount NUMERIC;
  base_amount NUMERIC;
  distance_amount NUMERIC;
  peak_bonus NUMERIC;
BEGIN
  -- Calculate payout
  payout_calc := calculate_delivery_payout(p_distance_km, p_delivery_time, p_agent_id);
  
  total_amount := (payout_calc->>'total_payout')::NUMERIC;
  base_amount := (payout_calc->>'base_pay')::NUMERIC;
  distance_amount := (payout_calc->>'distance_pay')::NUMERIC;
  peak_bonus := (payout_calc->>'peak_bonus')::NUMERIC;
  
  -- Create earning record
  INSERT INTO earnings (agent_id, order_id, amount, status)
  VALUES (p_agent_id, p_order_id, total_amount, 'completed');
  
  -- Update agent wallet with base pay + distance pay
  INSERT INTO agent_wallet_transactions (
    agent_id, 
    transaction_type, 
    amount, 
    order_id, 
    description,
    status
  ) VALUES (
    p_agent_id,
    'delivery_payment',
    base_amount + distance_amount,
    p_order_id,
    'Delivery payment: Base ₹' || base_amount || ' + Distance ₹' || distance_amount,
    'completed'
  );
  
  -- Add peak bonus as separate transaction if applicable
  IF peak_bonus > 0 THEN
    INSERT INTO agent_wallet_transactions (
      agent_id, 
      transaction_type, 
      amount, 
      description,
      status
    ) VALUES (
      p_agent_id,
      'peak_bonus',
      peak_bonus,
      'Peak hour bonus for ' || (payout_calc->'peak_orders_today') || ' orders',
      'completed'
    );
  END IF;
  
  -- Update agent wallet balance
  UPDATE agent_wallet 
  SET 
    balance = balance + total_amount,
    total_collected = total_collected + total_amount,
    updated_at = now()
  WHERE agent_id = p_agent_id;
  
  -- Create wallet record if it doesn't exist
  INSERT INTO agent_wallet (agent_id, balance, total_collected)
  VALUES (p_agent_id, total_amount, total_amount)
  ON CONFLICT (agent_id) DO NOTHING;
  
  RETURN payout_calc;
END;
$$;

-- Create trigger to automatically process payouts when delivery is completed
CREATE OR REPLACE FUNCTION auto_process_delivery_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  distance_km NUMERIC := 2.0; -- Default distance, should be calculated from actual route
BEGIN
  -- Only process when delivery is marked as completed
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at != NEW.completed_at) THEN
    -- Use distance from metadata if available, otherwise default
    IF NEW.delivery_duration IS NOT NULL THEN
      distance_km := COALESCE((NEW.distance_traveled), 2.0);
    END IF;
    
    -- Process the payout
    PERFORM process_delivery_payout(
      NEW.agent_id,
      NEW.order_id,
      distance_km,
      NEW.completed_at
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic payout processing
DROP TRIGGER IF EXISTS trigger_auto_process_delivery_payout ON delivery_history;
CREATE TRIGGER trigger_auto_process_delivery_payout
  AFTER INSERT OR UPDATE ON delivery_history
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_delivery_payout();

-- RLS policies for payout_config
ALTER TABLE payout_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payout config"
ON payout_config
FOR ALL
USING (is_current_user_admin_v2())
WITH CHECK (is_current_user_admin_v2());

CREATE POLICY "Anyone can view active payout config"
ON payout_config
FOR SELECT
USING (is_active = true);