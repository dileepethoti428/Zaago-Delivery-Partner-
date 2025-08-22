-- Create comprehensive notification system for customers, sellers, and admins

-- Add source_type and source_id to agent_notifications for better tracking
ALTER TABLE agent_notifications ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'system';
ALTER TABLE agent_notifications ADD COLUMN IF NOT EXISTS source_id UUID;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_notifications_source ON agent_notifications(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_read ON agent_notifications(agent_id, read);

-- Create function to create notifications from different sources
CREATE OR REPLACE FUNCTION create_agent_notification(
  target_agent_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_message TEXT,
  source_type TEXT DEFAULT 'system',
  source_id UUID DEFAULT NULL,
  notification_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO agent_notifications (
    agent_id,
    type,
    title,
    message,
    source_type,
    source_id,
    metadata,
    read
  ) VALUES (
    target_agent_id,
    notification_type,
    notification_title,
    notification_message,
    source_type,
    source_id,
    notification_metadata,
    false
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Create trigger to send notifications when orders are created/updated
CREATE OR REPLACE FUNCTION notify_agent_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only notify if agent is assigned
  IF NEW.agent_id IS NOT NULL THEN
    -- New order assigned
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.agent_id IS NULL) THEN
      PERFORM create_agent_notification(
        NEW.agent_id,
        'order',
        'New Order Assigned',
        'You have been assigned a new delivery order #' || NEW.id::text,
        'customer',
        NEW.user_id,
        jsonb_build_object(
          'order_id', NEW.id,
          'total', NEW.total,
          'customer_name', NEW.customer_name,
          'delivery_date', NEW.delivery_date
        )
      );
    END IF;
    
    -- Order status updates
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'confirmed' THEN
          PERFORM create_agent_notification(
            NEW.agent_id,
            'order',
            'Order Confirmed',
            'Order #' || NEW.id::text || ' has been confirmed and is ready for pickup',
            'customer',
            NEW.user_id,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
          );
        WHEN 'cancelled' THEN
          PERFORM create_agent_notification(
            NEW.agent_id,
            'alert',
            'Order Cancelled',
            'Order #' || NEW.id::text || ' has been cancelled',
            'customer',
            NEW.user_id,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
          );
      END CASE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for order notifications
DROP TRIGGER IF EXISTS trigger_notify_agent_on_order_change ON orders;
CREATE TRIGGER trigger_notify_agent_on_order_change
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_agent_on_order_change();

-- Function to create admin notifications for agents
CREATE OR REPLACE FUNCTION create_admin_notification_for_agent(
  target_agent_id UUID,
  notification_title TEXT,
  notification_message TEXT,
  admin_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN create_agent_notification(
    target_agent_id,
    'admin',
    notification_title,
    notification_message,
    'admin',
    admin_id,
    jsonb_build_object('sent_by', 'admin', 'timestamp', now())
  );
END;
$$;

-- Function to create seller notifications for agents
CREATE OR REPLACE FUNCTION create_seller_notification_for_agent(
  target_agent_id UUID,
  notification_title TEXT,
  notification_message TEXT,
  seller_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN create_agent_notification(
    target_agent_id,
    'seller',
    notification_title,
    notification_message,
    'seller',
    seller_id,
    jsonb_build_object('sent_by', 'seller', 'timestamp', now())
  );
END;
$$;