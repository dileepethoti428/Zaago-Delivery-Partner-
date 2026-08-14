-- Details for a single compensation delivery (assigned agent only)
CREATE OR REPLACE FUNCTION public.get_compensation_details(p_compensation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_internal_id uuid;
  v_row RECORD;
  v_is_prepaid boolean;
  v_seller_address text;
  v_delivery_addr jsonb;
BEGIN
  SELECT da.id INTO v_agent_internal_id
    FROM public.delivery_agents da
   WHERE da.agent_id = auth.uid()
   LIMIT 1;

  IF v_agent_internal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery partner profile not found');
  END IF;

  SELECT vc.id,
         vc.status,
         vc.quantity,
         vc.compensation_delivery_date,
         vc.original_vacation_date,
         vc.subscription_id,
         vc.created_at,
         s.delivery_address,
         s.delivery_time_slot,
         s.special_instructions,
         s.payment_id,
         c.full_name AS customer_name,
         c.phone AS customer_phone,
         c.address AS customer_address,
         c.city AS customer_city,
         c.state AS customer_state,
         c.pincode AS customer_pincode,
         c.latitude AS customer_latitude,
         c.longitude AS customer_longitude,
         p.name AS product_name,
         p.price AS product_price,
         p.image_url AS product_image,
         p.unit AS product_unit,
         sel.business_name AS seller_name,
         sel.phone AS seller_phone,
         sel.address AS seller_address,
         sel.latitude AS seller_latitude,
         sel.longitude AS seller_longitude
    INTO v_row
    FROM public.vacation_compensations vc
    LEFT JOIN public.subscriptions s ON s.id = vc.subscription_id
    LEFT JOIN public.customers c ON c.id = vc.customer_id
    LEFT JOIN public.products p ON p.id = vc.product_id
    LEFT JOIN public.sellers sel ON sel.user_id = p.seller_id
   WHERE vc.id = p_compensation_id
     AND vc.assigned_agent_id = v_agent_internal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compensation not found or not assigned to you');
  END IF;

  v_is_prepaid := v_row.payment_id IS NOT NULL;

  v_delivery_addr := CASE
    WHEN v_row.delivery_address IS NULL THEN '{}'::jsonb
    ELSE v_row.delivery_address
  END;

  v_seller_address := CASE
    WHEN v_row.seller_address IS NULL THEN ''
    WHEN jsonb_typeof(to_jsonb(v_row.seller_address)) = 'object' THEN
      concat_ws(', ',
        NULLIF(to_jsonb(v_row.seller_address)->>'address',''),
        NULLIF(to_jsonb(v_row.seller_address)->>'city',''),
        NULLIF(to_jsonb(v_row.seller_address)->>'state',''),
        NULLIF(to_jsonb(v_row.seller_address)->>'pincode',''))
    ELSE v_row.seller_address::text
  END;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_row.id,
    'status', COALESCE(v_row.status, 'pending'),
    'is_compensation', true,
    'original_missed_date', v_row.original_vacation_date,
    'payment_method', CASE WHEN v_is_prepaid THEN 'ONLINE' ELSE 'COD' END,
    'payment_status', CASE WHEN v_is_prepaid THEN 'paid' ELSE 'pending' END,
    'total_amount', COALESCE(v_row.product_price, 0) * COALESCE(v_row.quantity, 1),
    'delivery_charge', 0,
    'delivery_time_slot', v_row.delivery_time_slot,
    'delivery_date', v_row.compensation_delivery_date,
    'subscription_id', v_row.subscription_id,
    'special_instructions', v_row.special_instructions,
    'created_at', v_row.created_at,
    'items', jsonb_build_array(jsonb_build_object(
      'product_name', v_row.product_name,
      'name', v_row.product_name,
      'price', COALESCE(v_row.product_price, 0),
      'quantity', COALESCE(v_row.quantity, 1),
      'image_url', v_row.product_image,
      'unit', v_row.product_unit
    )),
    'customer', jsonb_build_object(
      'name', COALESCE(v_row.customer_name, 'Customer'),
      'phone', COALESCE(v_row.customer_phone, ''),
      'address', COALESCE(NULLIF(v_delivery_addr->>'full_address',''), v_row.customer_address, ''),
      'city', COALESCE(NULLIF(v_delivery_addr->>'city',''), v_row.customer_city, ''),
      'state', COALESCE(NULLIF(v_delivery_addr->>'state',''), v_row.customer_state, ''),
      'pincode', COALESCE(NULLIF(v_delivery_addr->>'pincode',''), v_row.customer_pincode, ''),
      'landmark', NULLIF(v_delivery_addr->>'landmark',''),
      'coordinates', jsonb_build_object(
        'lat', COALESCE((v_delivery_addr->'coordinates'->>'lat')::double precision, v_row.customer_latitude),
        'lng', COALESCE((v_delivery_addr->'coordinates'->>'lng')::double precision, v_row.customer_longitude)
      )
    ),
    'seller', jsonb_build_object(
      'name', COALESCE(v_row.seller_name, 'Seller'),
      'phone', COALESCE(v_row.seller_phone, ''),
      'address', v_seller_address,
      'coordinates', jsonb_build_object('lat', v_row.seller_latitude, 'lng', v_row.seller_longitude)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_compensation_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_compensation_details(uuid) TO authenticated;

-- Replace the old single-arg completion function
DROP FUNCTION IF EXISTS public.complete_agent_compensation(uuid);

CREATE OR REPLACE FUNCTION public.complete_agent_compensation(
  p_compensation_id uuid,
  p_payment_method text DEFAULT 'COD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_internal_id uuid;
  v_row RECORD;
  v_rows integer;
  v_pm text;
  v_total numeric;
BEGIN
  SELECT da.id INTO v_agent_internal_id
    FROM public.delivery_agents da
   WHERE da.agent_id = auth.uid()
   LIMIT 1;

  IF v_agent_internal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Delivery partner profile not found');
  END IF;

  v_pm := CASE WHEN upper(COALESCE(p_payment_method, 'COD')) IN ('ONLINE','RAZORPAY','UPI') THEN 'ONLINE' ELSE 'COD' END;

  SELECT vc.*,
         c.full_name AS customer_name,
         c.phone AS customer_phone,
         c.address AS customer_address,
         c.city AS customer_city,
         c.state AS customer_state,
         c.pincode AS customer_pincode,
         p.name AS product_name,
         p.price AS product_price,
         s.delivery_time_slot
    INTO v_row
    FROM public.vacation_compensations vc
    LEFT JOIN public.customers c ON c.id = vc.customer_id
    LEFT JOIN public.products p ON p.id = vc.product_id
    LEFT JOIN public.subscriptions s ON s.id = vc.subscription_id
   WHERE vc.id = p_compensation_id
     AND vc.assigned_agent_id = v_agent_internal_id
   FOR UPDATE OF vc;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compensation not found or not assigned to you');
  END IF;

  IF v_row.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  UPDATE public.vacation_compensations
     SET status = 'delivered',
         delivered_at = now(),
         updated_at = now()
   WHERE id = p_compensation_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to update compensation');
  END IF;

  v_total := COALESCE(v_row.product_price, 0) * COALESCE(v_row.quantity, 1);

  -- Delivery history (idempotent on order_id + agent_id)
  INSERT INTO public.delivery_history (
    order_id, agent_id, customer_name, customer_phone, delivery_address,
    items, total_amount, payment_method, payment_status, delivery_date,
    delivery_time_slot, completed_at, delivery_payout
  ) VALUES (
    p_compensation_id,
    v_agent_internal_id,
    COALESCE(v_row.customer_name, 'Customer'),
    v_row.customer_phone,
    jsonb_build_object(
      'address', v_row.customer_address,
      'city', v_row.customer_city,
      'state', v_row.customer_state,
      'pincode', v_row.customer_pincode
    ),
    jsonb_build_array(jsonb_build_object(
      'name', COALESCE(v_row.product_name, 'Compensation Product'),
      'quantity', COALESCE(v_row.quantity, 1),
      'price', COALESCE(v_row.product_price, 0)
    )),
    v_total,
    v_pm,
    CASE WHEN v_pm = 'ONLINE' THEN 'paid' ELSE 'collected' END,
    COALESCE(v_row.compensation_delivery_date, (now() AT TIME ZONE 'Asia/Kolkata')::date),
    v_row.delivery_time_slot,
    now(),
    0
  )
  ON CONFLICT (order_id, agent_id) DO NOTHING;

  -- Earnings tracking, same shape as subscription deliveries (zero payout)
  IF NOT EXISTS (
    SELECT 1 FROM public.agent_earnings_tracking
     WHERE agent_id = v_agent_internal_id
       AND payout_breakdown->>'compensation_id' = p_compensation_id::text
  ) THEN
    INSERT INTO public.agent_earnings_tracking (
      order_id, daily_order_id, agent_id, accepted_at, completed_at,
      expected_payout, actual_payout, distance_km, is_peak_hour,
      payout_status, payout_breakdown, order_type, payment_method
    ) VALUES (
      NULL, NULL, v_agent_internal_id, now(), now(),
      0, 0, 0, false,
      'confirmed',
      jsonb_build_object('subscription', true, 'compensation', true,
                         'compensation_id', p_compensation_id,
                         'base_pay', 0, 'distance_pay', 0),
      'subscription',
      lower(v_pm)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'payout_amount', 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_agent_compensation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_agent_compensation(uuid, text) TO authenticated;