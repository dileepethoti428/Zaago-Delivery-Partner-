-- Fix 1: Allow subscription orders in agent_earnings_tracking
-- Drop the foreign key constraint that requires order_id to exist in orders table
ALTER TABLE agent_earnings_tracking 
DROP CONSTRAINT IF EXISTS agent_earnings_tracking_order_id_fkey;

-- Add daily_order_id column for subscription orders
ALTER TABLE agent_earnings_tracking 
ADD COLUMN IF NOT EXISTS daily_order_id uuid REFERENCES daily_orders(id);

-- Make order_id nullable so subscription orders can use daily_order_id instead
ALTER TABLE agent_earnings_tracking 
ALTER COLUMN order_id DROP NOT NULL;

-- Fix 3: Create RPC for delivered orders today
CREATE OR REPLACE FUNCTION get_agent_orders_delivered_today()
RETURNS TABLE (
  id uuid,
  date date,
  quantity numeric,
  status text,
  subscription_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_latitude numeric,
  customer_longitude numeric,
  product_id uuid,
  product_name text,
  product_unit text,
  product_image text,
  seller_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  -- Get agent_id from delivery_agents using auth.uid()
  SELECT da.agent_id INTO v_agent_id
  FROM delivery_agents da
  WHERE da.agent_id = auth.uid()
    AND da.is_active = true;
  
  IF v_agent_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.date,
    d.quantity,
    d.status,
    d.subscription_id,
    d.customer_id,
    c.full_name as customer_name,
    c.phone as customer_phone,
    c.address as customer_address,
    c.latitude as customer_latitude,
    c.longitude as customer_longitude,
    s.product_id,
    p.name as product_name,
    p.unit as product_unit,
    p.image_url as product_image,
    p.seller_id
  FROM daily_orders d
  LEFT JOIN subscriptions s ON d.subscription_id = s.id
  LEFT JOIN customers c ON d.customer_id = c.id
  LEFT JOIN products p ON s.product_id = p.id
  WHERE d.assigned_agent_id = v_agent_id
    AND d.date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    AND d.status = 'delivered'
  ORDER BY d.created_at DESC;
END;
$$;