-- Fix notify_agent_on_order_change trigger to use delivery_agents.id instead of auth user id
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
      -- Extract customer name from metadata
      customer_name := COALESCE(NEW.metadata->>'customer_name', 'Customer');
      
      -- Extract coordinates from metadata
      pickup_lat := (NEW.metadata->'pickup_location'->>'lat')::DOUBLE PRECISION;
      pickup_lng := (NEW.metadata->'pickup_location'->>'lng')::DOUBLE PRECISION;
      dropoff_lat := (NEW.metadata->'dropoff_location'->>'lat')::DOUBLE PRECISION;
      dropoff_lng := (NEW.metadata->'dropoff_location'->>'lng')::DOUBLE PRECISION;
      
      -- Create notification using delivery_agents.id
      PERFORM create_agent_notification(
        delivery_agent_id,
        NEW.id,
        NEW.status,
        customer_name,
        NEW.total_amount,
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