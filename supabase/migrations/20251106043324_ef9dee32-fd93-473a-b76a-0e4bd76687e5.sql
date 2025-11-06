-- Fix notify_agent_on_order_change trigger to use correct column names
CREATE OR REPLACE FUNCTION notify_agent_on_order_change()
RETURNS TRIGGER AS $$
DECLARE
  delivery_agent_id UUID;
  customer_name TEXT;
  pickup_lat DOUBLE PRECISION;
  pickup_lng DOUBLE PRECISION;
  dropoff_lat DOUBLE PRECISION;
  dropoff_lng DOUBLE PRECISION;
BEGIN
  -- Only proceed if agent_id is set
  IF NEW.agent_id IS NOT NULL THEN
    -- Look up the delivery_agents.id from the agent_id (auth user id)
    SELECT id INTO delivery_agent_id
    FROM delivery_agents
    WHERE agent_id = NEW.agent_id;
    
    -- Only create notification if delivery agent record exists
    IF delivery_agent_id IS NOT NULL THEN
      -- Use actual column names from orders table
      customer_name := COALESCE(NEW.customer_name, 'Customer');
      
      -- Extract coordinates from pickup_location jsonb
      IF NEW.pickup_location IS NOT NULL THEN
        pickup_lat := (NEW.pickup_location->>'lat')::DOUBLE PRECISION;
        pickup_lng := (NEW.pickup_location->>'lng')::DOUBLE PRECISION;
      END IF;
      
      -- Extract coordinates from address jsonb (delivery location)
      IF NEW.address IS NOT NULL THEN
        dropoff_lat := (NEW.address->>'latitude')::DOUBLE PRECISION;
        dropoff_lng := (NEW.address->>'longitude')::DOUBLE PRECISION;
      END IF;
      
      -- Create notification using delivery_agents.id and correct column names
      PERFORM create_agent_notification(
        delivery_agent_id,
        NEW.id,
        NEW.status,
        customer_name,
        NEW.total, -- Use 'total' not 'total_amount'
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;