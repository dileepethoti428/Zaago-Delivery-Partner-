-- Grant necessary permissions for pg_net usage
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- Drop and recreate the trigger function with proper error handling
DROP FUNCTION IF EXISTS trigger_process_flexible_payment() CASCADE;

CREATE OR REPLACE FUNCTION trigger_process_flexible_payment()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public, pg_catalog, net
LANGUAGE plpgsql
AS $$
DECLARE
  request_body jsonb;
  request_id bigint;
BEGIN
  -- Only trigger for pending status
  IF NEW.status = 'pending' THEN
    -- Prepare the request body
    request_body := jsonb_build_object('request_id', NEW.id);
    
    -- Invoke the edge function asynchronously using pg_net with correct signature
    -- Signature: http_post(url, body, params, headers, timeout_milliseconds)
    BEGIN
      SELECT INTO request_id net.http_post(
        url := 'https://amhpjsmubciahslghobw.supabase.co/functions/v1/process-flexible-payment-request',
        body := request_body,
        params := '{}'::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 10000
      );
      
      -- Log success
      RAISE NOTICE 'Queued payment request processing for %: pg_net request_id=%', NEW.id, request_id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the insert
      RAISE WARNING 'Failed to queue payment request %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_flexible_payment_request_created ON flexible_payment_requests;

CREATE TRIGGER on_flexible_payment_request_created
  AFTER INSERT ON flexible_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_process_flexible_payment();

COMMENT ON FUNCTION trigger_process_flexible_payment() IS 'Automatically processes flexible payment requests by calling the edge function via pg_net';