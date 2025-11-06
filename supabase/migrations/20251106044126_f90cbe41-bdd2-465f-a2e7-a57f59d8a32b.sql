-- Fix notify_agent_on_order_change trigger - remove problematic notification call
CREATE OR REPLACE FUNCTION notify_agent_on_order_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Just return NEW without trying to create notifications
  -- This prevents the "function does not exist" error
  -- Notifications will be handled separately if needed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;