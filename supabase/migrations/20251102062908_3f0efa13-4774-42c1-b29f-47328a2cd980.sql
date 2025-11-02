-- Step 1: Immediate fix for zaago@gmail.com user
UPDATE profiles 
SET 
  approval_status = 'approved',
  documents_verified = true,
  approved_at = NOW()
WHERE user_id = '3d16066a-7c2d-4e55-a12e-8e5db3bd97df';

-- Step 2: Create bi-directional trigger (reverse sync from delivery_agents to profiles)
CREATE OR REPLACE FUNCTION sync_profile_approval_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When delivery_agents verification_status changes, update profiles
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    UPDATE profiles
    SET 
      approval_status = NEW.verification_status,
      documents_verified = CASE 
        WHEN NEW.verification_status = 'approved' THEN true 
        ELSE false 
      END,
      approved_at = CASE 
        WHEN NEW.verification_status = 'approved' THEN NOW() 
        ELSE NULL 
      END,
      updated_at = NOW()
    WHERE user_id = NEW.agent_id::uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on delivery_agents table
CREATE TRIGGER sync_profile_status_trigger
  AFTER UPDATE ON delivery_agents
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_approval_status();