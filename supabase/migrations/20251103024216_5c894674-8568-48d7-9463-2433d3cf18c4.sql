-- Make sync_agent_phone_from_auth safe for new signups
-- This prevents the "relation delivery_agents does not exist" error
-- by only syncing phone for users who are already approved delivery agents

CREATE OR REPLACE FUNCTION public.sync_agent_phone_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  phone_to_sync text;
  agent_exists boolean;
BEGIN
  -- Priority: NEW.phone first, then fallback to metadata
  phone_to_sync := COALESCE(
    NEW.phone,
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Only proceed if we have a phone number
  IF phone_to_sync IS NOT NULL THEN
    -- Check if this email exists in delivery_agents table
    SELECT EXISTS(
      SELECT 1 FROM delivery_agents WHERE email = NEW.email
    ) INTO agent_exists;
    
    -- Only update if the agent already exists (approved agents)
    IF agent_exists THEN
      UPDATE delivery_agents
      SET phone = phone_to_sync
      WHERE email = NEW.email AND phone IS DISTINCT FROM phone_to_sync;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;