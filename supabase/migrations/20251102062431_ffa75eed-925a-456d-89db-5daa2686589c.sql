-- Function to sync delivery_agents.verification_status with profiles.approval_status
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS sync_verification_status_trigger ON profiles;
CREATE TRIGGER sync_verification_status_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
  EXECUTE FUNCTION sync_agent_verification_status();

-- Fix existing records where profiles are approved but delivery_agents are not
UPDATE delivery_agents da
SET 
  verification_status = 'approved',
  updated_at = NOW()
FROM profiles p
WHERE da.agent_id = p.user_id::text
  AND p.approval_status = 'approved'
  AND da.verification_status != 'approved';