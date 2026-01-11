-- Add theme_preference column to agent_settings table
ALTER TABLE agent_settings 
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('system', 'light', 'dark'));

-- Migrate existing dark_mode values to theme_preference
UPDATE agent_settings 
SET theme_preference = CASE 
  WHEN dark_mode = true THEN 'dark' 
  ELSE 'system' 
END
WHERE theme_preference IS NULL OR theme_preference = 'system';