-- Fix location columns precision issues
-- Update sellers table latitude/longitude to proper precision
ALTER TABLE sellers 
ALTER COLUMN latitude TYPE DOUBLE PRECISION,
ALTER COLUMN longitude TYPE DOUBLE PRECISION;

-- Update user_locations table latitude/longitude to proper precision  
ALTER TABLE user_locations
ALTER COLUMN latitude TYPE DOUBLE PRECISION,
ALTER COLUMN longitude TYPE DOUBLE PRECISION;

-- Ensure driver_locations has the right precision (should already be good)
-- Add indexes for better location query performance
CREATE INDEX IF NOT EXISTS idx_sellers_location 
ON sellers (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_locations_location 
ON user_locations (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_driver_locations_location 
ON driver_locations (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;