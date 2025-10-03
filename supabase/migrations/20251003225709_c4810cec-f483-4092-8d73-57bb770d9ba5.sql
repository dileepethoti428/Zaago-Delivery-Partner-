-- Drop the duplicate 3-parameter version of qr_complete_delivery_v3
-- This resolves the "Could not choose a best candidate function" error
DROP FUNCTION IF EXISTS qr_complete_delivery_v3(uuid, uuid, text);

-- The 6-parameter version with defaults will remain and work correctly
-- It can still be called with 3 parameters thanks to DEFAULT values