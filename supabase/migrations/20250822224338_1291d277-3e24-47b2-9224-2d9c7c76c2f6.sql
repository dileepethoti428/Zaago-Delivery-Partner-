-- Update the signup function to automatically approve users
CREATE OR REPLACE FUNCTION public.assign_admin_role_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile for the new user with approved status (auto-approve)
  INSERT INTO public.profiles (user_id, full_name, approval_status, approved_at)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'approved',  -- Auto-approve all new users
    now()        -- Set approval timestamp
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign user role to all new users automatically
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Only assign admin role if this is the first user (bootstrap admin)
  -- Check if there are any existing admin users
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update the agent signin function to auto-approve agents as well
CREATE OR REPLACE FUNCTION public.handle_agent_signin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Only handle when user signs in (not sign up)
    IF TG_OP = 'UPDATE' AND OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
        -- Insert if missing and auto-activate agents
        INSERT INTO delivery_agents (
            email,
            name,
            agent_id,
            is_active  -- Auto-activate agents
        ) VALUES (
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'agent_id', NEW.id::text),
            true  -- Auto-activate agents instead of requiring approval
        )
        ON CONFLICT (email) DO UPDATE SET
            name = COALESCE(EXCLUDED.name, delivery_agents.name),
            agent_id = COALESCE(delivery_agents.agent_id, EXCLUDED.agent_id),
            is_active = true,  -- Auto-activate on signin
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$function$;