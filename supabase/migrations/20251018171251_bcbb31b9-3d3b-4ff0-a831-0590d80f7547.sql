-- Drop the problematic trigger that's causing silent failures
DROP TRIGGER IF EXISTS sync_order_status_on_delivery_history ON delivery_history;

-- Drop the redundant function (edge function already handles order status updates)
DROP FUNCTION IF EXISTS sync_order_status_with_delivery();