
-- Fix failing order acceptance by making the order-change notification trigger safe

CREATE OR REPLACE FUNCTION public.notify_agent_on_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only notify if agent is assigned
  IF NEW.agent_id IS NOT NULL THEN
    -- New order assigned (on insert or when agent_id becomes non-null)
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.agent_id IS NULL AND NEW.agent_id IS NOT NULL) THEN
      PERFORM create_agent_notification(
        NEW.agent_id,
        'order_assigned',
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
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      CASE NEW.status
        WHEN 'confirmed' THEN
          PERFORM create_agent_notification(
            NEW.agent_id,
            'status_update',
            'Order Confirmed',
            'Order #' || NEW.id::text || ' has been confirmed and is ready for pickup',
            'customer',
            NEW.user_id,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
          );
        WHEN 'cancelled' THEN
          PERFORM create_agent_notification(
            NEW.agent_id,
            'status_update',
            'Order Cancelled',
            'Order #' || NEW.id::text || ' has been cancelled',
            'customer',
            NEW.user_id,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
          );
        WHEN 'out_for_delivery' THEN
          PERFORM create_agent_notification(
            NEW.agent_id,
            'status_update',
            'Out for Delivery',
            'Order #' || NEW.id::text || ' is out for delivery',
            'customer',
            NEW.user_id,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
          );
        WHEN 'delivered' THEN
          PERFORM create_agent_notification(
            NEW.agent_id,
            'status_update',
            'Order Delivered',
            'Order #' || NEW.id::text || ' has been delivered',
            'customer',
            NEW.user_id,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
          );
        ELSE
          -- No notification for other statuses (e.g., 'assigned', 'placed'); avoid throwing "case not found"
          NULL;
      END CASE;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
