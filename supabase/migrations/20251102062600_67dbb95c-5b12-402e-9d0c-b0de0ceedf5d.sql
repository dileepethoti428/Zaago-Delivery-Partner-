-- Fix search_path for sync_agent_verification_status function
CREATE OR REPLACE FUNCTION sync_agent_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When profile approval_status changes, update delivery_agents
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    UPDATE delivery_agents
    SET 
      verification_status = NEW.approval_status,
      updated_at = NOW()
    WHERE agent_id = NEW.user_id::text;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;