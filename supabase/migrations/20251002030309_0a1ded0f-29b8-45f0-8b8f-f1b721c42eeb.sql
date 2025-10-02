-- Create function to notify agents when order becomes packed
CREATE OR REPLACE FUNCTION notify_agents_on_packed_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger if status changed to 'packed' and order is unassigned
  IF NEW.status = 'packed' AND OLD.status != 'packed' AND NEW.agent_id IS NULL THEN
    -- Call the notify-delivery-agents edge function asynchronously
    PERFORM net.http_post(
      url := 'https://amhpjsmubciahslghobw.supabase.co/functions/v1/notify-delivery-agents',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtaHBqc211YmNpYWhzbGdob2J3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MzAxNjksImV4cCI6MjA3MTEwNjE2OX0.QtKx2Nvm0MkIgJUXSoUxQH20l7W-UyzdVInVps_z70Y'
      ),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'status', NEW.status,
        'customer_name', NEW.customer_name,
        'total_amount', NEW.total
      )
    );
    
    -- Log the notification trigger
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'auto_notify_agents_triggered',
        'order_id', NEW.id,
        'status', NEW.status,
        'triggered_at', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_notify_agents_on_packed ON orders;
CREATE TRIGGER trigger_notify_agents_on_packed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_agents_on_packed_order();