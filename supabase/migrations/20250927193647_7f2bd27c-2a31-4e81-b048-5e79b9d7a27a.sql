-- Reset QR code status for testing order c04d7d43-5b1c-4acd-b314-89713be36e0c
UPDATE order_qr_codes 
SET is_scanned = false, 
    scanned_at = null, 
    scanned_by = null 
WHERE order_id = 'c04d7d43-5b1c-4acd-b314-89713be36e0c';

-- Also ensure the order is still assigned to agent f37deb4f-45d9-4ea7-964c-084b3c60e533
UPDATE orders 
SET status = 'assigned', 
    delivered_at = null, 
    payment_status = 'pending'
WHERE id = 'c04d7d43-5b1c-4acd-b314-89713be36e0c';