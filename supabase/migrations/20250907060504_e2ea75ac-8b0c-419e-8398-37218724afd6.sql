-- Fix latitude and longitude precision in delivery_agents table
-- Current NUMERIC(5,2) is too small for proper coordinates
-- Latitude: -90 to +90, Longitude: -180 to +180
-- We need more precision for accurate location tracking

-- Update the delivery_agents table to use proper precision for coordinates
ALTER TABLE delivery_agents 
ALTER COLUMN latitude TYPE DOUBLE PRECISION,
ALTER COLUMN longitude TYPE DOUBLE PRECISION;

-- Add index for better performance on location queries
CREATE INDEX IF NOT EXISTS idx_delivery_agents_location 
ON delivery_agents (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;