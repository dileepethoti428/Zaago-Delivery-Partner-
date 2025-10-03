-- Automatic Notification Trigger for Delivery Agents
-- This trigger automatically sends notifications to agents when order status changes
-- Works independently of seller app

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_notify_agents ON orders;
DROP FUNCTION IF EXISTS notify_agents_on_order_change() CASCADE;

-- Create improved notification function
CREATE OR REPLACE FUNCTION notify_agents_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger if:
  -- 1. Status changed to packed, confirmed, or placed
  -- 2. Order is unassigned (no agent yet)
  -- 3. Notification hasn't been sent yet for this status
  IF NEW.status IN ('packed', 'confirmed', 'placed') 
     AND OLD.status != NEW.status 
     AND NEW.agent_id IS NULL
     AND (NEW.agent_notification_sent IS NULL OR NEW.agent_notification_sent = false) THEN
    
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
        'customer_name', COALESCE(NEW.customer_name, 'Unknown'),
        'total_amount', NEW.total
      )
    );
    
    -- Update notification sent flag
    NEW.agent_notification_sent := true;
    
    -- Log the automatic notification trigger
    INSERT INTO password_reset_logs (
      email,
      event_type,
      metadata
    ) VALUES (
      'system@zaago.com',
      'email_sent',
      jsonb_build_object(
        'action', 'automatic_agent_notification',
        'order_id', NEW.id,
        'order_status', NEW.status,
        'triggered_by', 'database_trigger',
        'triggered_at', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires on order status changes
CREATE TRIGGER trigger_notify_agents
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('packed', 'confirmed', 'placed') AND OLD.status != NEW.status)
  EXECUTE FUNCTION notify_agents_on_order_change();

-- Log the trigger creation
INSERT INTO password_reset_logs (
  email,
  event_type,
  metadata
) VALUES (
  'system@zaago.com',
  'email_sent',
  jsonb_build_object(
    'action', 'automatic_notification_trigger_created',
    'trigger_name', 'trigger_notify_agents',
    'created_at', now(),
    'note', 'Notifications will now be sent automatically when orders are packed, confirmed, or placed'
  )
);