-- Fix the sync trigger to handle cases where delivery_agents record doesn't exist yet
CREATE OR REPLACE FUNCTION sync_agent_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When profile approval_status changes, update delivery_agents IF IT EXISTS
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    -- Only update if a delivery_agents record exists for this user
    UPDATE delivery_agents
    SET 
      verification_status = NEW.approval_status,
      updated_at = NOW()
    WHERE agent_id = NEW.user_id::text
      AND EXISTS (
        SELECT 1 FROM delivery_agents 
        WHERE agent_id = NEW.user_id::text
      );
    
    -- No error if record doesn't exist - this is expected for new signups
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;