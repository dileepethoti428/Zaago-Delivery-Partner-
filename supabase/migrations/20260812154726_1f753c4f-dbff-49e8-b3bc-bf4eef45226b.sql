CREATE OR REPLACE FUNCTION public.get_agent_compensations(p_date date)
RETURNS TABLE(
  order_id uuid,
  order_date date,
  quantity numeric,
  order_status text,
  subscription_id uuid,
  customer_id uuid,
  location_id bigint,
  created_at timestamp with time zone,
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
  product_image_url text,
  is_on_vacation boolean,
  seller_latitude double precision,
  seller_longitude double precision,
  seller_name text,
  original_missed_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT vc.id, vc.compensation_delivery_date, vc.quantity::numeric, 'pending'::text,
         vc.subscription_id, vc.customer_id, NULL::bigint, vc.created_at,
         vc.assigned_agent_id, 'compensation'::text,
         s.delivery_address, s.delivery_time_slot, s.delivery_latitude, s.delivery_longitude,
         c.full_name, c.phone, c.address, c.city, c.pincode, c.latitude, c.longitude,
         p.id, p.name, p.price, p.image_url,
         false,
         sel.latitude, sel.longitude, sel.business_name,
         vc.original_vacation_date
  FROM vacation_compensations vc
  LEFT JOIN subscriptions s ON s.id = vc.subscription_id
  LEFT JOIN customers c ON c.id = vc.customer_id
  LEFT JOIN products p ON p.id = vc.product_id
  LEFT JOIN sellers sel ON sel.user_id = p.seller_id
  WHERE vc.assigned_agent_id = auth.uid()
    AND vc.compensation_delivery_date = p_date
    AND vc.status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_compensations(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_agent_compensation(p_compensation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  UPDATE vacation_compensations
     SET status = 'delivered',
         delivered_at = now(),
         updated_at = now()
   WHERE id = p_compensation_id
     AND assigned_agent_id = auth.uid()
     AND status <> 'delivered';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    IF EXISTS (SELECT 1 FROM vacation_compensations WHERE id = p_compensation_id AND assigned_agent_id = auth.uid() AND status = 'delivered') THEN
      RETURN jsonb_build_object('success', true, 'already_completed', true);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Compensation not found or not assigned to you');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_agent_compensation(uuid) TO authenticated;