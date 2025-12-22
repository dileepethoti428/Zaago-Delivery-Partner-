-- Create trigger function to auto-create delivery_agents row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_delivery_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert into delivery_agents with default values
  INSERT INTO public.delivery_agents (
    agent_id,
    email,
    name,
    phone,
    is_online,
    is_active,
    verification_status,
    documents_verified,
    total_deliveries,
    total_earnings,
    average_rating,
    deliveries_today,
    max_capacity
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1), 'Agent'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data ->> 'phone'),
    false,
    false,
    'pending',
    false,
    0,
    0,
    0,
    0,
    5
  )
  ON CONFLICT (agent_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_delivery_agent ON auth.users;

-- Create trigger that fires when a new user is created in auth.users
CREATE TRIGGER on_auth_user_created_delivery_agent
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_delivery_agent();

-- Also create default agent_settings when agent is created
CREATE OR REPLACE FUNCTION public.handle_new_agent_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert default settings for the new agent
  INSERT INTO public.agent_settings (
    agent_id,
    is_available,
    auto_accept_orders,
    notify_new_orders,
    notify_earnings_updates,
    notify_promotions,
    preferred_language,
    dark_mode,
    push_notifications,
    sound_alerts,
    vibration,
    ringtone_enabled,
    ringtone_type,
    ringtone_volume
  )
  VALUES (
    NEW.agent_id,
    false,
    false,
    true,
    true,
    true,
    'en',
    false,
    true,
    true,
    true,
    true,
    'default',
    80
  )
  ON CONFLICT (agent_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_delivery_agent_created_settings ON public.delivery_agents;

-- Create trigger that fires when a new delivery agent is created
CREATE TRIGGER on_delivery_agent_created_settings
  AFTER INSERT ON public.delivery_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_agent_settings();