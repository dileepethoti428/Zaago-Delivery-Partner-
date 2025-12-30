-- Add OneSignal external user ID column to profiles table (if not exists)
-- This stores the OneSignal external_id (user email) for push notification targeting

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onesignal_external_user_id TEXT;

-- Add index for fast lookups when targeting users by OneSignal external ID
CREATE INDEX IF NOT EXISTS idx_profiles_onesignal_external_user_id
ON public.profiles (onesignal_external_user_id);

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.onesignal_external_user_id IS 'OneSignal external_id (user email) for push notification targeting by edge functions and cron jobs';