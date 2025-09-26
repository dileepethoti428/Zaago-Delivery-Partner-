-- Reset inconsistent QR codes that were scanned but orders weren't delivered
UPDATE order_qr_codes 
SET is_scanned = false, 
    scanned_at = NULL, 
    scanned_by = NULL, 
    updated_at = now()
WHERE order_id IN (
  SELECT oqc.order_id 
  FROM order_qr_codes oqc 
  JOIN orders o ON oqc.order_id = o.id 
  WHERE oqc.is_scanned = true 
  AND o.status != 'delivered'
);

-- Add some debug logging
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'qr_codes_reset_for_fix',
    'reset_count', (
      SELECT COUNT(*) 
      FROM order_qr_codes oqc 
      JOIN orders o ON oqc.order_id = o.id 
      WHERE oqc.is_scanned = false 
      AND o.status IN ('assigned', 'packed')
    ),
    'reset_time', now()
  )
);