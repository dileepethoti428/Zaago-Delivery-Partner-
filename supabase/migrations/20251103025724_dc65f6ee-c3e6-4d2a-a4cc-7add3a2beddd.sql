-- Fix search_path security issue for the trigger functions
-- Setting search_path prevents potential SQL injection attacks in SECURITY DEFINER functions

CREATE OR REPLACE FUNCTION public.sync_agent_phone_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_to_sync text;
  agent_exists boolean;
BEGIN
  phone_to_sync := COALESCE(
    NEW.phone,
    NEW.raw_user_meta_data->>'phone'
  );
  
  IF phone_to_sync IS NOT NULL THEN
    BEGIN
      SELECT EXISTS(
        SELECT 1 FROM delivery_agents WHERE email = NEW.email
      ) INTO agent_exists;
      
      IF agent_exists THEN
        UPDATE delivery_agents
        SET phone = phone_to_sync
        WHERE email = NEW.email AND phone IS DISTINCT FROM phone_to_sync;
      END IF;
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to sync phone to delivery_agents: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_agent_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    BEGIN
      UPDATE delivery_agents
      SET 
        verification_status = NEW.approval_status,
        updated_at = NOW()
      WHERE agent_id = NEW.user_id::text;
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to sync verification status: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;