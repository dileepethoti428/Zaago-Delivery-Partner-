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
DECLARE
  v_agent_internal_id uuid;
  v_today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT da.id
    INTO v_agent_internal_id
    FROM public.delivery_agents da
   WHERE da.agent_id = auth.uid()
   LIMIT 1;

  IF v_agent_internal_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT vc.id,
         vc.compensation_delivery_date,
         vc.quantity::numeric,
         vc.status,
         vc.subscription_id,
         vc.customer_id,
         NULL::bigint,
         vc.created_at,
         vc.assigned_agent_id,
         'compensation'::text,
         s.delivery_address,
         s.delivery_time_slot,
         s.delivery_latitude,
         s.delivery_longitude,
         c.full_name,
         c.phone,
         c.address,
         c.city,
         c.pincode,
         c.latitude,
         c.longitude,
         p.id,
         p.name,
         p.price,
         p.image_url,
         false,
         sel.latitude,
         sel.longitude,
         sel.business_name,
         vc.original_vacation_date
    FROM public.vacation_compensations vc
    LEFT JOIN public.subscriptions s ON s.id = vc.subscription_id
    LEFT JOIN public.customers c ON c.id = vc.customer_id
    LEFT JOIN public.products p ON p.id = vc.product_id
    LEFT JOIN public.sellers sel ON sel.user_id = p.seller_id
   WHERE vc.assigned_agent_id = v_agent_internal_id
     AND vc.status = 'pending'
     AND (
       (p_date = v_today_ist AND vc.compensation_delivery_date <= p_date)
       OR
       (p_date <> v_today_ist AND vc.compensation_delivery_date = p_date)
     )
   ORDER BY vc.compensation_delivery_date, vc.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_agent_compensation(p_compensation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_internal_id uuid;
  v_rows integer;
BEGIN
  SELECT da.id
    INTO v_agent_internal_id
    FROM public.delivery_agents da
   WHERE da.agent_id = auth.uid()
   LIMIT 1;

  IF v_agent_internal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery partner profile not found');
  END IF;

  UPDATE public.vacation_compensations
     SET status = 'delivered',
         delivered_at = now(),
         updated_at = now()
   WHERE id = p_compensation_id
     AND assigned_agent_id = v_agent_internal_id
     AND status <> 'delivered';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    IF EXISTS (
      SELECT 1
        FROM public.vacation_compensations
       WHERE id = p_compensation_id
         AND assigned_agent_id = v_agent_internal_id
         AND status = 'delivered'
    ) THEN
      RETURN jsonb_build_object('success', true, 'already_completed', true);
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Compensation not found or not assigned to you');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_agent_compensations(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_agent_compensation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_compensations(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_agent_compensation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_compensations(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_agent_compensation(uuid) TO service_role;