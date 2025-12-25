-- Drop existing functions
DROP FUNCTION IF EXISTS get_agent_orders_today();
DROP FUNCTION IF EXISTS get_agent_orders_tomorrow();
DROP FUNCTION IF EXISTS get_agent_orders_upcoming();

-- RPC 1: Get agent orders for TODAY with enriched data
CREATE OR REPLACE FUNCTION get_agent_orders_today()
RETURNS TABLE (
  id uuid,
  date date,
  quantity numeric,
  status text,
  subscription_id uuid,
  customer_id uuid,
  location_id bigint,
  created_at timestamptz,
  assigned_agent_id uuid,
  assigned_by text,
  delivery_address jsonb,
  delivery_time_slot text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_city text,
  customer_pincode text,
  customer_latitude double precision,
  customer_longitude double precision,
  product_id uuid,
  product_name text,
  product_price numeric,
  product_image text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.date,
    d.quantity,
    d.status,
    d.subscription_id,
    d.customer_id,
    d.location_id,
    d.created_at,
    d.assigned_agent_id,
    d.assigned_by,
    s.delivery_address,
    s.delivery_time_slot,
    s.delivery_latitude,
    s.delivery_longitude,
    c.full_name as customer_name,
    c.phone as customer_phone,
    c.address as customer_address,
    c.city as customer_city,
    c.pincode as customer_pincode,
    c.latitude as customer_latitude,
    c.longitude as customer_longitude,
    p.id as product_id,
    p.name as product_name,
    p.price as product_price,
    p.image_url as product_image
  FROM daily_orders d
  LEFT JOIN subscriptions s ON d.subscription_id = s.id
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN products p ON s.product_id = p.id
  WHERE d.assigned_agent_id = auth.uid()
    AND d.date = CURRENT_DATE
    AND d.status IN ('pending', 'assigned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Get agent orders for TOMORROW with enriched data
CREATE OR REPLACE FUNCTION get_agent_orders_tomorrow()
RETURNS TABLE (
  id uuid,
  date date,
  quantity numeric,
  status text,
  subscription_id uuid,
  customer_id uuid,
  location_id bigint,
  created_at timestamptz,
  assigned_agent_id uuid,
  assigned_by text,
  delivery_address jsonb,
  delivery_time_slot text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_city text,
  customer_pincode text,
  customer_latitude double precision,
  customer_longitude double precision,
  product_id uuid,
  product_name text,
  product_price numeric,
  product_image text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.date,
    d.quantity,
    d.status,
    d.subscription_id,
    d.customer_id,
    d.location_id,
    d.created_at,
    d.assigned_agent_id,
    d.assigned_by,
    s.delivery_address,
    s.delivery_time_slot,
    s.delivery_latitude,
    s.delivery_longitude,
    c.full_name as customer_name,
    c.phone as customer_phone,
    c.address as customer_address,
    c.city as customer_city,
    c.pincode as customer_pincode,
    c.latitude as customer_latitude,
    c.longitude as customer_longitude,
    p.id as product_id,
    p.name as product_name,
    p.price as product_price,
    p.image_url as product_image
  FROM daily_orders d
  LEFT JOIN subscriptions s ON d.subscription_id = s.id
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN products p ON s.product_id = p.id
  WHERE d.assigned_agent_id = auth.uid()
    AND d.date = CURRENT_DATE + 1
    AND d.status IN ('pending', 'assigned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 3: Get agent orders for UPCOMING (after tomorrow) with enriched data
CREATE OR REPLACE FUNCTION get_agent_orders_upcoming()
RETURNS TABLE (
  id uuid,
  date date,
  quantity numeric,
  status text,
  subscription_id uuid,
  customer_id uuid,
  location_id bigint,
  created_at timestamptz,
  assigned_agent_id uuid,
  assigned_by text,
  delivery_address jsonb,
  delivery_time_slot text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_city text,
  customer_pincode text,
  customer_latitude double precision,
  customer_longitude double precision,
  product_id uuid,
  product_name text,
  product_price numeric,
  product_image text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.date,
    d.quantity,
    d.status,
    d.subscription_id,
    d.customer_id,
    d.location_id,
    d.created_at,
    d.assigned_agent_id,
    d.assigned_by,
    s.delivery_address,
    s.delivery_time_slot,
    s.delivery_latitude,
    s.delivery_longitude,
    c.full_name as customer_name,
    c.phone as customer_phone,
    c.address as customer_address,
    c.city as customer_city,
    c.pincode as customer_pincode,
    c.latitude as customer_latitude,
    c.longitude as customer_longitude,
    p.id as product_id,
    p.name as product_name,
    p.price as product_price,
    p.image_url as product_image
  FROM daily_orders d
  LEFT JOIN subscriptions s ON d.subscription_id = s.id
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN products p ON s.product_id = p.id
  WHERE d.assigned_agent_id = auth.uid()
    AND d.date > CURRENT_DATE + 1
    AND d.status IN ('pending', 'assigned');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;