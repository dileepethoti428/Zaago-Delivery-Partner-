-- Create a super simple function that updates only the essential fields
CREATE OR REPLACE FUNCTION complete_delivery_minimal_update(
  p_order_id UUID,
  p_payment_method TEXT DEFAULT 'Online'
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = CASE 
      WHEN p_payment_method = 'COD' THEN 'paid_cod' 
      ELSE 'paid_online' 
    END,
    updated_at = NOW()
  WHERE id = p_order_id
  RETURNING jsonb_build_object(
    'success', true,
    'message', 'Order completed successfully'
  );
$$;