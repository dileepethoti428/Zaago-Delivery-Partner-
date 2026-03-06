
DROP FUNCTION IF EXISTS get_agent_orders_today();
DROP FUNCTION IF EXISTS get_agent_orders_tomorrow();
DROP FUNCTION IF EXISTS get_agent_orders_upcoming();

CREATE FUNCTION get_agent_orders_today()
RETURNS TABLE (
  order_id uuid, order_date date, quantity integer, order_status text,
  subscription_id uuid, customer_id uuid, location_id integer,
  created_at timestamptz, assigned_agent_id uuid, assigned_by text,
  delivery_address text, delivery_time_slot text,
  delivery_latitude double precision, delivery_longitude double precision,
  customer_name text, customer_phone text, customer_address text,
  customer_city text, customer_pincode text,
  customer_latitude double precision, customer_longitude double precision,
  product_id uuid, product_name text, product_price numeric, product_image_url text,
  is_on_vacation boolean,
  seller_latitude double precision, seller_longitude double precision
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.date, d.quantity, d.status,
    d.subscription_id, d.customer_id, d.location_id,
    d.created_at, d.assigned_agent_id, d.assigned_by,
    s.delivery_address, s.delivery_time_slot,
    s.delivery_latitude, s.delivery_longitude,
    c.full_name, c.phone, c.address, c.city, c.pincode,
    c.latitude, c.longitude,
    p.id, p.name, p.price, p.image_url,
    (sv.id IS NOT NULL OR svp.id IS NOT NULL),
    sel.latitude AS seller_latitude,
    sel.longitude AS seller_longitude
  FROM daily_orders d
  LEFT JOIN subscriptions s ON d.subscription_id = s.id
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN products p ON s.product_id = p.id
  LEFT JOIN sellers sel ON p.seller_id = sel.user_id
  LEFT JOIN subscription_vacations sv
    ON sv.subscription_id = d.subscription_id
    AND d.date BETWEEN sv.start_date AND sv.end_date
    AND sv.status IN ('approved', 'active')
  LEFT JOIN subscription_vacation_periods svp
    ON svp.subscription_id = d.subscription_id
    AND d.date BETWEEN svp.start_date AND svp.end_date
    AND svp.status IN ('approved', 'active')
  WHERE d.assigned_agent_id = auth.uid()
    AND d.date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    AND d.status IN ('pending', 'assigned');
END;
$$;

CREATE FUNCTION get_agent_orders_tomorrow()
RETURNS TABLE (
  order_id uuid, order_date date, quantity integer, order_status text,
  subscription_id uuid, customer_id uuid, location_id integer,
  created_at timestamptz, assigned_agent_id uuid, assigned_by text,
  delivery_address text, delivery_time_slot text,
  delivery_latitude double precision, delivery_longitude double precision,
  customer_name text, customer_phone text, customer_address text,
  customer_city text, customer_pincode text,
  customer_latitude double precision, customer_longitude double precision,
  product_id uuid, product_name text, product_price numeric, product_image_url text,
  is_on_vacation boolean,
  seller_latitude double precision, seller_longitude double precision
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.date, d.quantity, d.status,
    d.subscription_id, d.customer_id, d.location_id,
    d.created_at, d.assigned_agent_id, d.assigned_by,
    s.delivery_address, s.delivery_time_slot,
    s.delivery_latitude, s.delivery_longitude,
    c.full_name, c.phone, c.address, c.city, c.pincode,
    c.latitude, c.longitude,
    p.id, p.name, p.price, p.image_url,
    (sv.id IS NOT NULL OR svp.id IS NOT NULL),
    sel.latitude AS seller_latitude,
    sel.longitude AS seller_longitude
  FROM daily_orders d
  LEFT JOIN subscriptions s ON d.subscription_id = s.id
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN products p ON s.product_id = p.id
  LEFT JOIN sellers sel ON p.seller_id = sel.user_id
  LEFT JOIN subscription_vacations sv
    ON sv.subscription_id = d.subscription_id
    AND d.date BETWEEN sv.start_date AND sv.end_date
    AND sv.status IN ('approved', 'active')
  LEFT JOIN subscription_vacation_periods svp
    ON svp.subscription_id = d.subscription_id
    AND d.date BETWEEN svp.start_date AND svp.end_date
    AND svp.status IN ('approved', 'active')
  WHERE d.assigned_agent_id = auth.uid()
    AND d.date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + 1
    AND d.status IN ('pending', 'assigned');
END;
$$;

CREATE FUNCTION get_agent_orders_upcoming()
RETURNS TABLE (
  order_id uuid, order_date date, quantity integer, order_status text,
  subscription_id uuid, customer_id uuid, location_id integer,
  created_at timestamptz, assigned_agent_id uuid, assigned_by text,
  delivery_address text, delivery_time_slot text,
  delivery_latitude double precision, delivery_longitude double precision,
  customer_name text, customer_phone text, customer_address text,
  customer_city text, customer_pincode text,
  customer_latitude double precision, customer_longitude double precision,
  product_id uuid, product_name text, product_price numeric, product_image_url text,
  is_on_vacation boolean,
  seller_latitude double precision, seller_longitude double precision
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.date, d.quantity, d.status,
    d.subscription_id, d.customer_id, d.location_id,
    d.created_at, d.assigned_agent_id, d.assigned_by,
    s.delivery_address, s.delivery_time_slot,
    s.delivery_latitude, s.delivery_longitude,
    c.full_name, c.phone, c.address, c.city, c.pincode,
    c.latitude, c.longitude,
    p.id, p.name, p.price, p.image_url,
    (sv.id IS NOT NULL OR svp.id IS NOT NULL),
    sel.latitude AS seller_latitude,
    sel.longitude AS seller_longitude
  FROM daily_orders d
  LEFT JOIN subscriptions s ON d.subscription_id = s.id
  LEFT JOIN customers c ON s.customer_id = c.id
  LEFT JOIN products p ON s.product_id = p.id
  LEFT JOIN sellers sel ON p.seller_id = sel.user_id
  LEFT JOIN subscription_vacations sv
    ON sv.subscription_id = d.subscription_id
    AND d.date BETWEEN sv.start_date AND sv.end_date
    AND sv.status IN ('approved', 'active')
  LEFT JOIN subscription_vacation_periods svp
    ON svp.subscription_id = d.subscription_id
    AND d.date BETWEEN svp.start_date AND svp.end_date
    AND svp.status IN ('approved', 'active')
  WHERE d.assigned_agent_id = auth.uid()
    AND d.date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + 1
    AND d.status IN ('pending', 'assigned');
END;
$$;
