-- Create trigger function to send OneSignal notification on order status update
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT := 'https://amhpjsmubciahslghobw.supabase.co';
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Call edge function via pg_net extension to send OneSignal notification
    PERFORM
      net.http_post(
        url := supabase_url || '/functions/v1/send-order-update-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.jwt_secret', true)
        ),
        body := jsonb_build_object(
          'orderId', NEW.id::text,
          'status', NEW.status,
          'userId', NEW.user_id::text
        )
      );
      
    -- Log the trigger execution
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'order_status_trigger_fired',
        'order_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'user_id', NEW.user_id,
        'triggered_at', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS order_status_notification_trigger ON orders;
CREATE TRIGGER order_status_notification_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();