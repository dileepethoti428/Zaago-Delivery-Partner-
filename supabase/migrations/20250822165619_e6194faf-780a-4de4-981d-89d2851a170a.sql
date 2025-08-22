
CREATE OR REPLACE FUNCTION public._notify_rider_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  _title text; 
  _msg text; 
  _uid uuid; 
  _link text;
  _agent_user_id uuid;
BEGIN
  -- Get the user_id for the delivery agent
  IF NEW.agent_id IS NOT NULL THEN
    SELECT id INTO _agent_user_id 
    FROM auth.users 
    WHERE email IN (
      SELECT email FROM delivery_agents WHERE id = NEW.agent_id
    )
    LIMIT 1;
  END IF;

  -- New assignment
  IF (TG_OP='UPDATE' AND NEW.agent_id IS NOT NULL AND (OLD.agent_id IS DISTINCT FROM NEW.agent_id)) THEN
    IF _agent_user_id IS NOT NULL THEN
      _title := 'New delivery assigned';
      _msg := 'Order #' || NEW.id || ' is assigned to you. Pickup soon.';
      _link := '/deliveries/' || NEW.id;
      
      INSERT INTO notifications(user_id, role, title, message, type, link, order_id)
      VALUES(_agent_user_id, 'agent', _title, _msg, 'assignment', _link, NEW.id);
    END IF;
  END IF;

  -- Status updates relevant to rider
  IF (TG_OP='UPDATE' AND NEW.agent_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status) THEN
    IF _agent_user_id IS NOT NULL THEN
      IF NEW.status = 'cancelled' THEN
        _title := 'Assignment cancelled';
        _msg := 'Order #' || NEW.id || ' was cancelled.';
        _link := '/deliveries/' || NEW.id;
        
        INSERT INTO notifications(user_id, role, title, message, type, link, order_id)
        VALUES(_agent_user_id, 'agent', _title, _msg, 'order_update', _link, NEW.id);
        
      ELSIF NEW.status IN ('confirmed', 'assigned', 'out_for_delivery') THEN
        _title := 'Status updated: ' || NEW.status;
        _msg := 'Order #' || NEW.id || ' is now ' || NEW.status || '.';
        _link := '/deliveries/' || NEW.id;
        
        INSERT INTO notifications(user_id, role, title, message, type, link, order_id)
        VALUES(_agent_user_id, 'agent', _title, _msg, 'order_update', _link, NEW.id);
        
      ELSIF NEW.status = 'delivered' THEN
        _title := 'Delivery completed';
        _msg := 'Great job! Order #' || NEW.id || ' has been delivered successfully.';
        _link := '/history';
        
        INSERT INTO notifications(user_id, role, title, message, type, link, order_id)
        VALUES(_agent_user_id, 'agent', _title, _msg, 'delivery_success', _link, NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
