-- Fix the complete_delivery_minimal_update function to use plpgsql for write operations
CREATE OR REPLACE FUNCTION complete_delivery_minimal_update(
  p_order_id UUID,
  p_payment_method TEXT DEFAULT 'Online'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the order with minimal fields to avoid JSON validation issues
  UPDATE orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = CASE 
      WHEN p_payment_method = 'COD' THEN 'paid_cod' 
      ELSE 'paid_online' 
    END,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order completed successfully'
  );
END;
$$;