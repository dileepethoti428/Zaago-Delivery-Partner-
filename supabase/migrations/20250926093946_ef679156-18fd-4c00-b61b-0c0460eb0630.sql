-- Reset QR codes that are marked as scanned but orders aren't delivered
-- This fixes the inconsistent state caused by the failed delivery completion

UPDATE order_qr_codes 
SET is_scanned = false, 
    scanned_at = null, 
    scanned_by = null
WHERE order_id IN (
  SELECT o.id 
  FROM orders o 
  JOIN order_qr_codes qr ON o.id = qr.order_id 
  WHERE o.agent_id = '7da1881e-50e8-4f88-86ad-9c8dd74b9e5e' 
    AND qr.is_scanned = true 
    AND o.status != 'delivered'
);

-- Create a simpler delivery completion function that doesn't use complex wallet operations
CREATE OR REPLACE FUNCTION complete_delivery_simple(
  p_agent_id UUID,
  p_order_id UUID,
  p_payment_method TEXT DEFAULT 'prepaid',
  p_distance_km DECIMAL DEFAULT 2.5
) RETURNS JSON AS $$
DECLARE
  v_payout_amount DECIMAL := 12;
  v_result JSON;
BEGIN
  -- Calculate base payout (₹12 base + ₹2 per km if over 2km)
  IF p_distance_km > 2 THEN
    v_payout_amount := 12 + ((p_distance_km - 2) * 2);
  END IF;

  -- Update order status
  UPDATE orders 
  SET status = 'delivered',
      delivered_at = now(),
      payment_status = CASE 
        WHEN p_payment_method = 'COD' THEN 'paid_cod'
        ELSE 'paid_online'
      END
  WHERE id = p_order_id AND agent_id = p_agent_id;

  -- Insert earnings record (avoid duplicates)
  INSERT INTO earnings (agent_id, order_id, amount, status, distance_km, payment_method, description)
  VALUES (
    p_agent_id, 
    p_order_id, 
    v_payout_amount, 
    'completed', 
    p_distance_km,
    CASE WHEN p_payment_method = 'COD' THEN 'COD' ELSE 'Online' END,
    'Delivery payout for order ' || LEFT(p_order_id::TEXT, 8)
  )
  ON CONFLICT (agent_id, order_id) DO NOTHING;

  -- Return success result
  v_result := json_build_object(
    'success', true,
    'payout_amount', v_payout_amount,
    'order_id', p_order_id,
    'agent_id', p_agent_id
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;