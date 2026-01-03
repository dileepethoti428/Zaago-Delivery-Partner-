-- Fix the notify_rider_on_assignment trigger to use agent_id instead of user_id
CREATE OR REPLACE FUNCTION public.notify_rider_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  _agent_user_id uuid;
  _title text;
  _body text;
BEGIN
  -- Only notify when agent is assigned
  IF NEW.assigned_agent_id IS NOT NULL
     AND NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN

    -- Use agent_id column (the auth user id) instead of non-existent user_id
    SELECT agent_id
    INTO _agent_user_id
    FROM delivery_agents
    WHERE id = NEW.assigned_agent_id;

    IF _agent_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    _title := '🚴 New Delivery Assigned';
    _body  := 'Order #' || NEW.id || ' is ready for pickup';

    INSERT INTO notifications (
      user_id,
      title,
      body,
      data
    ) VALUES (
      _agent_user_id,
      _title,
      _body,
      jsonb_build_object(
        'type', 'order_update',
        'role', 'agent',
        'order_id', NEW.id,
        'status', NEW.status,
        'screen', 'agent-deliveries',
        'link', '/deliveries/' || NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;