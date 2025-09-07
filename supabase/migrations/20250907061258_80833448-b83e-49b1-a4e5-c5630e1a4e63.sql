-- Fix remaining NUMERIC(5,2) columns in driver_locations that might be causing overflow
-- These columns can receive large values that exceed NUMERIC(5,2) limits

-- Update accuracy to allow larger values (GPS accuracy can be in meters, could be > 999.99)
ALTER TABLE driver_locations 
ALTER COLUMN accuracy TYPE DOUBLE PRECISION;

-- Update heading to allow full range (0-360 degrees is fine, but let's be safe)
ALTER TABLE driver_locations 
ALTER COLUMN heading TYPE DOUBLE PRECISION;

-- Update speed to allow larger values (speed in m/s could exceed 999.99)
ALTER TABLE driver_locations 
ALTER COLUMN speed TYPE DOUBLE PRECISION;