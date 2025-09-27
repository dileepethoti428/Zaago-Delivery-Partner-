-- Drop the existing function and create a simplified version
DROP FUNCTION IF EXISTS public.complete_delivery_minimal_update(uuid, text);

-- Create a completely simplified delivery completion function that avoids any JSON operations
CREATE OR REPLACE FUNCTION public.complete_delivery_minimal_update(
  p_order_id UUID,
  p_payment_method TEXT DEFAULT 'Online'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_status TEXT;
BEGIN
  -- Determine payment status based on method
  IF p_payment_method = 'COD' THEN
    v_payment_status := 'paid_cod';
  ELSE
    v_payment_status := 'paid_online';
  END IF;
  
  -- Simple update without any JSON operations
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = v_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Return success if row was updated
  RETURN FOUND;
END;
$$;