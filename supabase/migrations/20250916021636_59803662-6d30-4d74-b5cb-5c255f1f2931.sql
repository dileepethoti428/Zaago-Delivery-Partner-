-- Add auto_logout column to agent_settings table
ALTER TABLE public.agent_settings 
ADD COLUMN IF NOT EXISTS auto_logout BOOLEAN DEFAULT true;