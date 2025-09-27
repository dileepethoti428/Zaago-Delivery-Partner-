-- Fix the complete_delivery_minimal_update function to properly bypass RLS
DROP FUNCTION IF EXISTS public.complete_delivery_minimal_update(uuid, text);

-- Create a robust delivery completion function that completely bypasses RLS
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
  v_updated_count INTEGER;
BEGIN
  -- Determine payment status based on method
  IF p_payment_method = 'COD' THEN
    v_payment_status := 'paid_cod';
  ELSE
    v_payment_status := 'paid_online';
  END IF;
  
  -- Use explicit UPDATE with WHERE clause - bypasses RLS due to SECURITY DEFINER
  -- This executes with the function owner's privileges, not the caller's
  UPDATE public.orders 
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    payment_status = v_payment_status,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Get count of updated rows
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Return true if at least one row was updated
  RETURN v_updated_count > 0;
  
EXCEPTION WHEN OTHERS THEN
  -- Log error and return false
  RAISE LOG 'Error in complete_delivery_minimal_update for order %: %', p_order_id, SQLERRM;
  RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.complete_delivery_minimal_update(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_delivery_minimal_update(uuid, text) TO service_role;