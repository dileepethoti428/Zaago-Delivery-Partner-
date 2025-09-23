-- Create function to clear agent_id when order status becomes 'packed'
CREATE OR REPLACE FUNCTION clear_agent_on_packed()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to 'packed', clear the agent_id to make it available
  IF NEW.status = 'packed' AND OLD.status != 'packed' THEN
    NEW.agent_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically clear agent_id when order becomes packed
DROP TRIGGER IF EXISTS clear_agent_on_packed_trigger ON orders;
CREATE TRIGGER clear_agent_on_packed_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION clear_agent_on_packed();