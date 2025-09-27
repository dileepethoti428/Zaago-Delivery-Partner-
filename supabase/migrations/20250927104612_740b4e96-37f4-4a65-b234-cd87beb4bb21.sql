-- Fix the trigger issue by dropping with CASCADE first
DROP TRIGGER IF EXISTS notify_agents_on_order_acceptance ON orders;
DROP TRIGGER IF EXISTS trigger_notify_agents_on_acceptance ON orders;
DROP FUNCTION IF EXISTS notify_agents_on_order_acceptance() CASCADE;

-- Create a simpler function that just creates notifications directly
CREATE OR REPLACE FUNCTION notify_agents_on_order_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to accepted, confirmed, or packed
  IF NEW.status IN ('accepted', 'confirmed', 'packed') 
     AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    
    -- Create immediate agent notifications for all active agents
    INSERT INTO agent_notifications (agent_id, type, title, message, source_type, source_id, metadata, read)
    SELECT 
      da.id,
      CASE 
        WHEN NEW.status = 'packed' THEN 'order_packed'
        ELSE 'order_available'
      END,
      CASE 
        WHEN NEW.status = 'packed' THEN '🚨 Order Packed & Ready!'
        ELSE '📦 New Order Available'
      END,
      CASE 
        WHEN NEW.status = 'packed' THEN 'Order from ' || COALESCE(NEW.customer_name, 'customer') || ' has been packed and is ready for pickup'
        ELSE 'New order from ' || COALESCE(NEW.customer_name, 'customer') || ' for ₹' || COALESCE(NEW.total, 0)
      END,
      'system',
      NEW.id,
      jsonb_build_object(
        'order_id', NEW.id,
        'status', NEW.status,
        'customer_name', NEW.customer_name,
        'total_amount', NEW.total,
        'notification_time', now(),
        'priority', CASE WHEN NEW.status = 'packed' THEN 'high' ELSE 'normal' END
      ),
      false
    FROM delivery_agents da
    WHERE da.is_active = true;
    
    -- Update the order to mark notification as sent
    UPDATE orders 
    SET agent_notification_sent = true
    WHERE id = NEW.id;
    
    -- Log the notification trigger
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'agent_notifications_created',
        'order_id', NEW.id,
        'status', NEW.status,
        'customer_name', NEW.customer_name,
        'total_amount', NEW.total,
        'notification_count', (SELECT COUNT(*) FROM delivery_agents WHERE is_active = true)
      )
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER notify_agents_on_order_acceptance
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_agents_on_order_acceptance();