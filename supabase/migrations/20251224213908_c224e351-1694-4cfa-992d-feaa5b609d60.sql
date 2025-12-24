-- RPC 1: Get agent orders for TODAY
CREATE OR REPLACE FUNCTION get_agent_orders_today()
RETURNS SETOF daily_orders AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM daily_orders
  WHERE assigned_agent_id = auth.uid()
    AND date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Get agent orders for TOMORROW
CREATE OR REPLACE FUNCTION get_agent_orders_tomorrow()
RETURNS SETOF daily_orders AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM daily_orders
  WHERE assigned_agent_id = auth.uid()
    AND date = CURRENT_DATE + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 3: Get agent orders for UPCOMING (future dates after tomorrow)
CREATE OR REPLACE FUNCTION get_agent_orders_upcoming()
RETURNS SETOF daily_orders AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM daily_orders
  WHERE assigned_agent_id = auth.uid()
    AND date > CURRENT_DATE + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;