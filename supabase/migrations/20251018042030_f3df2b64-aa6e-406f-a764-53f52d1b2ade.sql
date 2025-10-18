-- Create trigger function to ensure delivery_history timestamps are always set
CREATE OR REPLACE FUNCTION set_delivery_history_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Always set completed_at if it's NULL
  IF NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;
  
  -- Always set created_at if it's NULL
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  
  -- Always set updated_at if it's NULL
  IF NEW.updated_at IS NULL THEN
    NEW.updated_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create BEFORE INSERT trigger on delivery_history
DROP TRIGGER IF EXISTS ensure_delivery_history_timestamps ON delivery_history;
CREATE TRIGGER ensure_delivery_history_timestamps
  BEFORE INSERT ON delivery_history
  FOR EACH ROW
  EXECUTE FUNCTION set_delivery_history_timestamps();