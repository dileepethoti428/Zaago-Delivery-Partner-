-- Drop the existing check constraint for ringtone_type
ALTER TABLE agent_settings DROP CONSTRAINT IF EXISTS agent_settings_ringtone_type_check;

-- Add a new check constraint that includes all the new ringtone types
ALTER TABLE agent_settings ADD CONSTRAINT agent_settings_ringtone_type_check 
CHECK (ringtone_type IN (
  'phone-ringtone',
  'notification-sound', 
  'iphone-notification',
  'samsung-notification',
  'android-notification',
  'classic-bell',
  'chimes-notification',
  'iphone-ringtone',
  'iphone-marimba',
  'iphone-opening'
));