-- Drop the existing function first to change return type
DROP FUNCTION IF EXISTS get_agent_orders_delivered_today();

-- Recreate with correct column types (double precision for lat/lng)
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
  customer_latitude double precision,
  customer_longitude double precision,
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
  SELECT da.agent_id INTO v_agent_id
  FROM delivery_agents da
  WHERE da.agent_id = auth.uid()
    AND da.is_active = true;
  
  IF v_agent_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    d.id::uuid,
    d.date::date,
    d.quantity::numeric,
    d.status::text,
    d.subscription_id::uuid,
    d.customer_id::uuid,
    c.full_name::text as customer_name,
    c.phone::text as customer_phone,
    c.address::text as customer_address,
    c.latitude::double precision as customer_latitude,
    c.longitude::double precision as customer_longitude,
    s.product_id::uuid,
    p.name::text as product_name,
    p.unit::text as product_unit,
    p.image_url::text as product_image,
    p.seller_id::uuid
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