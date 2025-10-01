-- Create a simple trigger function to log when orders are marked as packed
-- This will help us track when the notification system should fire

CREATE OR REPLACE FUNCTION log_order_packed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log when status changes to 'packed' and no agent assigned
  IF NEW.status = 'packed' 
     AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'packed')
     AND NEW.agent_id IS NULL 
  THEN
    -- Log the event for monitoring
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'order_marked_as_packed_trigger',
        'order_id', NEW.id,
        'order_status', NEW.status,
        'customer_name', NEW.customer_name,
        'total_amount', NEW.total,
        'timestamp', now(),
        'note', 'Order marked as packed - notification should be sent'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_log_order_packed ON orders;

CREATE TRIGGER trigger_log_order_packed
  AFTER INSERT OR UPDATE OF status
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_packed();

COMMENT ON TRIGGER trigger_log_order_packed ON orders IS 
  'Logs when orders are marked as packed for monitoring notification system';