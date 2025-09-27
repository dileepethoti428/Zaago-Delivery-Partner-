-- Create simpler trigger function that just sets notification flag
CREATE OR REPLACE FUNCTION set_notification_flag_on_pack()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes TO 'packed'
  IF NEW.status = 'packed' AND (OLD.status IS NULL OR OLD.status != 'packed') THEN
    -- Set flag to trigger frontend notifications
    NEW.agent_notification_sent = false; -- This will be picked up by frontend
    NEW.updated_at = now();
    
    -- Log the pack event
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'order_packed_db_trigger',
        'order_id', NEW.id,
        'customer_name', NEW.customer_name,
        'total_amount', NEW.total,
        'packed_at', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_notify_agents_on_pack ON orders;
CREATE TRIGGER trigger_set_notification_flag_on_pack
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_notification_flag_on_pack();