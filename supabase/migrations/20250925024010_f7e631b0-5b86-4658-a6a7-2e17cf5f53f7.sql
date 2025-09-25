-- Add ringtone configuration fields to agent_settings table
ALTER TABLE public.agent_settings 
ADD COLUMN IF NOT EXISTS ringtone_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS ringtone_volume numeric DEFAULT 0.8 CHECK (ringtone_volume >= 0.0 AND ringtone_volume <= 1.0),
ADD COLUMN IF NOT EXISTS ringtone_type text DEFAULT 'phone-ringtone' CHECK (ringtone_type IN ('phone-ringtone', 'notification-sound', 'custom')),
ADD COLUMN IF NOT EXISTS notification_frequency text DEFAULT 'double' CHECK (notification_frequency IN ('single', 'double', 'continuous'));

-- Update existing records to have default ringtone settings
UPDATE public.agent_settings 
SET 
  ringtone_enabled = true,
  ringtone_volume = 0.8,
  ringtone_type = 'phone-ringtone',
  notification_frequency = 'double'
WHERE ringtone_enabled IS NULL;