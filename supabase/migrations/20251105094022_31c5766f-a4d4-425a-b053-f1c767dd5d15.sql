-- Create a function to invoke the edge function for processing flexible payment requests
CREATE OR REPLACE FUNCTION trigger_process_flexible_payment()
RETURNS TRIGGER AS $$
DECLARE
  request_body jsonb;
BEGIN
  -- Only trigger for pending status
  IF NEW.status = 'pending' THEN
    -- Prepare the request body
    request_body := jsonb_build_object('request_id', NEW.id);
    
    -- Invoke the edge function asynchronously using pg_net
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/process-flexible-payment-request',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := request_body
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on flexible_payment_requests
DROP TRIGGER IF EXISTS on_flexible_payment_request_created ON flexible_payment_requests;

CREATE TRIGGER on_flexible_payment_request_created
  AFTER INSERT ON flexible_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_flexible_payment();

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;