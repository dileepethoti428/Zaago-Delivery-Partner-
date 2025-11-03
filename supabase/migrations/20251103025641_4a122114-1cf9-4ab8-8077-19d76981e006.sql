-- Make trigger functions bulletproof with exception handling
-- This prevents "relation delivery_agents does not exist" errors during new signups
-- by catching and gracefully handling any database access errors

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
    BEGIN
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
    EXCEPTION
      WHEN undefined_table THEN
        -- Table doesn't exist yet, silently continue
        NULL;
      WHEN OTHERS THEN
        -- Any other error, log but don't fail the signup
        RAISE WARNING 'Failed to sync phone to delivery_agents: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Make sync_agent_verification_status bulletproof with exception handling
CREATE OR REPLACE FUNCTION public.sync_agent_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When profile approval_status changes, update delivery_agents IF IT EXISTS
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    BEGIN
      -- Only update if a delivery_agents record exists for this user
      UPDATE delivery_agents
      SET 
        verification_status = NEW.approval_status,
        updated_at = NOW()
      WHERE agent_id = NEW.user_id::text;
    EXCEPTION
      WHEN undefined_table THEN
        -- Table doesn't exist, silently continue
        NULL;
      WHEN OTHERS THEN
        -- Log but don't fail
        RAISE WARNING 'Failed to sync verification status: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;