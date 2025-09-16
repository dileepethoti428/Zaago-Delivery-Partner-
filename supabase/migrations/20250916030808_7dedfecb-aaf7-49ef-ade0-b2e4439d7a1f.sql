CREATE OR REPLACE FUNCTION public.create_order_from_existing_subscription(p_subscription_id uuid, p_order_type text DEFAULT 'scheduled'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_product RECORD;
  v_order_id UUID;
  v_items JSONB;
  v_total NUMERIC;
  v_delivery_date DATE;
  v_should_skip BOOLEAN := false;
  v_actual_delivery_time TIME;
BEGIN
  -- Get subscription details with product info
  SELECT 
    s.*,
    p.name as product_name,
    p.price as product_price,
    p.image_url as product_image,
    p.unit as product_unit,
    p.type as product_type
  INTO v_subscription
  FROM subscriptions s
  JOIN products p ON s.product_id = p.id
  WHERE s.id = p_subscription_id AND s.is_active = true AND p.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active subscription or product not found with ID: %', p_subscription_id;
  END IF;
  
  -- Calculate delivery date
  v_delivery_date := CASE 
    WHEN p_order_type = 'alternative' THEN CURRENT_DATE + 1
    WHEN p_order_type = 'immediate' THEN CURRENT_DATE
    ELSE COALESCE(v_subscription.next_delivery_date, CURRENT_DATE + 1)
  END;
  
  -- Check if delivery should be skipped due to vacation
  SELECT should_skip_delivery_for_vacation_v2(p_subscription_id, v_delivery_date) INTO v_should_skip;
  
  IF v_should_skip THEN
    -- Don't create order, but log that delivery was skipped
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata
    ) VALUES (
      (SELECT email FROM auth.users WHERE id = v_subscription.user_id),
      'email_sent',
      jsonb_build_object(
        'action', 'delivery_skipped_vacation',
        'subscription_id', p_subscription_id,
        'delivery_date', v_delivery_date,
        'order_type', p_order_type
      )
    );
    
    RETURN NULL; -- Return NULL to indicate no order was created
  END IF;
  
  -- Map delivery time slot to actual time
  v_actual_delivery_time := CASE v_subscription.delivery_time_slot
    WHEN 'morning-early' THEN '07:00:00'::TIME
    WHEN 'morning' THEN '09:00:00'::TIME
    WHEN 'morning-late' THEN '11:00:00'::TIME
    WHEN 'afternoon-early' THEN '13:00:00'::TIME
    WHEN 'afternoon' THEN '15:00:00'::TIME
    WHEN 'afternoon-late' THEN '17:00:00'::TIME
    WHEN 'evening-early' THEN '18:00:00'::TIME
    WHEN 'evening' THEN '19:00:00'::TIME
    WHEN 'evening-late' THEN '20:00:00'::TIME
    ELSE COALESCE(v_subscription.delivery_time, '12:00:00'::TIME)
  END;
  
  -- Calculate total
  v_total := v_subscription.product_price * v_subscription.quantity;
  
  -- Create items JSON
  v_items := jsonb_build_array(
    jsonb_build_object(
      'id', v_subscription.product_id,
      'name', v_subscription.product_name,
      'price', v_subscription.product_price,
      'quantity', v_subscription.quantity,
      'image_url', v_subscription.product_image,
      'unit', v_subscription.product_unit,
      'type', v_subscription.product_type
    )
  );
  
  -- Create order with proper delivery time
  INSERT INTO orders (
    user_id,
    address,
    items,
    total,
    delivery_date,
    delivery_time_slot,
    delivery_time,
    special_instructions,
    status,
    payment_status,
    subscription_id,
    customer_name,
    customer_phone
  ) VALUES (
    v_subscription.user_id,
    v_subscription.delivery_address,
    v_items,
    v_total,
    v_delivery_date,
    v_subscription.delivery_time_slot,
    v_actual_delivery_time,
    COALESCE(v_subscription.special_instructions, 'Subscription order'),
    'placed',
    'paid_subscription',
    p_subscription_id,
    COALESCE(v_subscription.delivery_address->>'full_name', 'Subscriber'),
    COALESCE(v_subscription.delivery_address->>'phone', '')
  ) RETURNING id INTO v_order_id;
  
  -- Update next delivery date for scheduled orders only
  IF p_order_type = 'scheduled' THEN
    UPDATE subscriptions
    SET 
      next_delivery_date = CASE 
        WHEN subscription_type = 'everyday' THEN v_delivery_date + 1
        WHEN subscription_type = 'alternative' THEN v_delivery_date + 2
        WHEN subscription_type = 'weekend' THEN 
          CASE WHEN EXTRACT(dow FROM v_delivery_date) = 6 THEN v_delivery_date + 1
               ELSE v_delivery_date + 6 END
        WHEN subscription_type = 'custom' AND delivery_days IS NOT NULL THEN
          -- Calculate next delivery based on custom days
          v_delivery_date + 1 -- Simplified, would need more complex logic
        ELSE v_delivery_date + 1
      END,
      updated_at = now()
    WHERE id = p_subscription_id;
  END IF;
  
  -- Log successful order creation
  INSERT INTO password_reset_logs (
    email,
    event_type,
    metadata
  ) VALUES (
    (SELECT email FROM auth.users WHERE id = v_subscription.user_id),
    'email_sent',
    jsonb_build_object(
      'action', 'subscription_order_created',
      'subscription_id', p_subscription_id,
      'order_id', v_order_id,
      'order_type', p_order_type,
      'delivery_date', v_delivery_date,
      'delivery_time', v_actual_delivery_time,
      'total', v_total
    )
  );
  
  RETURN v_order_id;
END;
$function$;