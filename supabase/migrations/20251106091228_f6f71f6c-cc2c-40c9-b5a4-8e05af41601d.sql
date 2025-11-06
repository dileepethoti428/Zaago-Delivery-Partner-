-- Fix function overloading issue by removing old UUID parameter versions
-- Drop the old UUID versions that conflict with TEXT versions

DROP FUNCTION IF EXISTS public.manual_complete_delivery(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.simple_mark_delivered(UUID, UUID, TEXT);

-- The TEXT versions are already created and will remain