-- Fix the notify_agents_on_order_acceptance trigger to use proper function calls
-- Drop the old trigger first
DROP TRIGGER IF EXISTS notify_agents_on_order_acceptance ON orders;

-- Create improved function that calls our edge function properly
CREATE OR REPLACE FUNCTION notify_agents_on_order_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  response record;
BEGIN
  -- Only trigger when status changes to accepted, confirmed, or packed
  IF NEW.status IN ('accepted', 'confirmed', 'packed') 
     AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    
    BEGIN
      -- Use supabase.functions.invoke instead of HTTP extension
      SELECT * INTO response FROM supabase.functions.invoke(
        'notify-delivery-agents',
        jsonb_build_object(
          'order_id', NEW.id,
          'status', NEW.status,
          'customer_name', NEW.customer_name,
          'total_amount', NEW.total
        )
      );
      
      -- Log successful call
      INSERT INTO password_reset_logs (
        email,
        event_type,
        metadata
      ) VALUES (
        'system@zaago.com',
        'email_sent',
        jsonb_build_object(
          'action', 'notify_agents_called',
          'order_id', NEW.id,
          'status', NEW.status,
          'response_status', 'success'
        )
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the order update
      INSERT INTO password_reset_logs (
        email,
        event_type,
        metadata,
        error
      ) VALUES (
        'system@zaago.com',
        'email_sent',
        jsonb_build_object(
          'action', 'notify_agents_failed',
          'order_id', NEW.id,
          'status', NEW.status
        ),
        SQLERRM
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER notify_agents_on_order_acceptance
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_agents_on_order_acceptance();

-- Update mark_order_as_packed function to include immediate notification
CREATE OR REPLACE FUNCTION mark_order_as_packed(order_id UUID)
RETURNS VOID AS $$
DECLARE
  order_record orders%ROWTYPE;
BEGIN
  -- Only allow admins to mark orders as packed
  IF NOT is_current_user_admin_v2() THEN
    RAISE EXCEPTION 'Only administrators can mark orders as packed';
  END IF;
  
  -- Get order details first
  SELECT * INTO order_record FROM orders WHERE id = order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found with ID: %', order_id;
  END IF;
  
  -- Update the order status to packed with notification flag
  UPDATE orders 
  SET 
    status = 'packed',
    agent_notification_sent = true,
    updated_at = now()
  WHERE id = order_id;
  
  -- Create immediate agent notifications for all active agents
  INSERT INTO agent_notifications (agent_id, type, title, message, source_type, source_id, metadata, read)
  SELECT 
    da.id,
    'order_packed',
    '🚨 Order Packed & Ready!',
    'Order from ' || COALESCE(order_record.customer_name, 'customer') || ' has been packed and is ready for pickup',
    'system',
    order_id,
    jsonb_build_object(
      'order_id', order_id,
      'customer_name', order_record.customer_name,
      'total_amount', order_record.total,
      'notification_time', now(),
      'priority', 'high'
    ),
    false
  FROM delivery_agents da
  WHERE da.is_active = true;
  
  -- Log the packing action
  INSERT INTO password_reset_logs (
    email,
    event_type,
    metadata
  ) VALUES (
    'system@zaago.com',
    'email_sent',
    jsonb_build_object(
      'action', 'order_marked_as_packed',
      'order_id', order_id,
      'customer_name', order_record.customer_name,
      'total_amount', order_record.total,
      'packed_at', now()
    )
  );
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;