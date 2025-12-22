-- Fix trigger defaults for agent_settings (ringtone_volume must be 0.0-1.0)
CREATE OR REPLACE FUNCTION public.handle_new_agent_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
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
    'iphone-ringtone',
    0.8
  )
  ON CONFLICT (agent_id) DO NOTHING;

  RETURN NEW;
END;
$$;