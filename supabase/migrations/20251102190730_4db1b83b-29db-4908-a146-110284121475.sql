-- Restore assign_admin_role_on_signup to the working version from Nov 2 morning
-- This removes the problematic phone and date_of_birth fields that were causing signup failures

CREATE OR REPLACE FUNCTION public.assign_admin_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create profile with PENDING status (require admin approval)
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    approval_status,
    documents_submitted,
    documents_verified
  )
  VALUES (
    NEW.id, 
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'name', 
      split_part(NEW.email, '@', 1)
    ),
    'pending',
    false,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign 'user' role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;