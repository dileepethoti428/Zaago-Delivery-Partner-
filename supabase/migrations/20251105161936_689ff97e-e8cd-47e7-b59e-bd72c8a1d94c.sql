-- Fix search_path security issue for the validation function
CREATE OR REPLACE FUNCTION validate_order_location_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate when changing to 'packed' status
  IF NEW.status = 'packed' AND (OLD.status IS NULL OR OLD.status != 'packed') THEN
    -- Check if order has pickup location (either pickup_address or pickup_location)
    IF (NEW.pickup_address IS NULL OR NEW.pickup_address = '') AND 
       (NEW.pickup_location IS NULL) THEN
      RAISE EXCEPTION 'Cannot mark order as packed: Missing pickup location data (pickup_address or pickup_location required)';
    END IF;
    
    -- Check if order has delivery address
    IF NEW.delivery_address_id IS NULL THEN
      RAISE EXCEPTION 'Cannot mark order as packed: Missing delivery address (delivery_address_id required)';
    END IF;
    
    -- Log the validation
    RAISE NOTICE 'Order % location validation passed - pickup: %, delivery: %', 
      NEW.id, 
      COALESCE(NEW.pickup_address, 'pickup_location set'), 
      NEW.delivery_address_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;