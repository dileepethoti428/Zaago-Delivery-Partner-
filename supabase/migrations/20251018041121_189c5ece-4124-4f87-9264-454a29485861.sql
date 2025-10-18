-- Create a safe delivery history insertion function with explicit column names
CREATE OR REPLACE FUNCTION public.insert_delivery_history_safe(
  p_order_id UUID,
  p_agent_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_delivery_address JSONB,
  p_items JSONB,
  p_total_amount NUMERIC,
  p_delivery_date DATE,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_delivery_payout NUMERIC,
  p_delivery_time_slot TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_id UUID;
BEGIN
  -- Insert with explicit column names to avoid any client-side mapping issues
  INSERT INTO delivery_history (
    order_id,
    agent_id,
    customer_name,
    customer_phone,
    delivery_address,
    items,
    total_amount,
    delivery_date,
    payment_method,
    payment_status,
    delivery_payout,
    delivery_time_slot,
    completed_at,
    created_at,
    updated_at
  ) VALUES (
    p_order_id,
    p_agent_id,
    p_customer_name,
    p_customer_phone,
    p_delivery_address,
    p_items,
    p_total_amount,
    p_delivery_date,
    p_payment_method,
    p_payment_status,
    p_delivery_payout,
    p_delivery_time_slot,
    NOW(),  -- completed_at
    NOW(),  -- created_at
    NOW()   -- updated_at
  )
  RETURNING id INTO v_delivery_id;
  
  RETURN v_delivery_id;
END;
$$;