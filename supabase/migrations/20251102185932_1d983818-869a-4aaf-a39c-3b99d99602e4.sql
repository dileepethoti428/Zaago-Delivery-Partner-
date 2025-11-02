-- Drop the conflicting trigger that's causing race condition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update assign_admin_role_on_signup to be comprehensive and handle all profile creation
CREATE OR REPLACE FUNCTION public.assign_admin_role_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip profile creation for phone-only users (handled by verify-otp edge function)
  IF NEW.email LIKE '%@phone.zaago.app' THEN
    RETURN NEW;
  END IF;

  -- Create comprehensive profile with all necessary fields
  INSERT INTO public.profiles (
    user_id, 
    full_name,
    phone,
    date_of_birth,
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
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    (NEW.raw_user_meta_data->>'date_of_birth')::date,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;