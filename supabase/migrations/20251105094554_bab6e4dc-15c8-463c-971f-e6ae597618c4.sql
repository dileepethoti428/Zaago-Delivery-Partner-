-- Fix trigger to use hardcoded URL without authentication headers
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
    -- No auth needed since edge function has verify_jwt = false and validates internally
    PERFORM net.http_post(
      url := 'https://amhpjsmubciahslghobw.supabase.co/functions/v1/process-flexible-payment-request',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := request_body
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';