-- Fix the direct_complete_delivery function to remove session_replication_role
CREATE OR REPLACE FUNCTION public.direct_complete_delivery(
  p_order_id uuid,
  p_new_status text,
  p_new_payment_status text,
  p_agent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_exists boolean := false;
BEGIN
  -- Check if order exists and belongs to agent
  SELECT EXISTS(
    SELECT 1 FROM public.orders 
    WHERE id = p_order_id AND agent_id = p_agent_id
  ) INTO v_order_exists;
  
  IF NOT v_order_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or not assigned to agent'
    );
  END IF;
  
  -- Direct field update without complex JSON operations
  UPDATE public.orders 
  SET 
    status = p_new_status,
    payment_status = p_new_payment_status,
    delivered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id AND agent_id = p_agent_id;
    
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order completed successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;