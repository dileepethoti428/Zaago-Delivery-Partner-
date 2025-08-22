-- Fix the notify_agent_on_order_change function to use correct notification types
CREATE OR REPLACE FUNCTION public.notify_agent_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only notify if agent is assigned
  IF NEW.agent_id IS NOT NULL THEN
    -- New order assigned
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.agent_id IS NULL) THEN
      PERFORM create_agent_notification(
        NEW.agent_id,
        'order_assigned',  -- Changed from 'order' to 'order_assigned'
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
            'status_update',  -- Changed from 'order' to 'status_update'
            'Order Confirmed',
            'Order #' || NEW.id::text || ' has been confirmed and is ready for pickup',
            'customer',
            NEW.user_id,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
          );
        WHEN 'cancelled' THEN
          PERFORM create_agent_notification(
            NEW.agent_id,
            'status_update',  -- Changed from 'alert' to 'status_update'
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
$function$;