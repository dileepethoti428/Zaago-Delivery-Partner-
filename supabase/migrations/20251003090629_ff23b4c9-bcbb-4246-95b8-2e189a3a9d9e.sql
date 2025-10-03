-- Fix remaining triggers that reference non-existent payment_method column
-- Both sync_payment_transaction and create_delivery_history_on_delivered try to read NEW.payment_method

-- Fix sync_payment_transaction function
DROP FUNCTION IF EXISTS sync_payment_transaction() CASCADE;

CREATE OR REPLACE FUNCTION public.sync_payment_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  derived_payment_method TEXT;
BEGIN
  -- Derive payment method from payment_status since payment_method column doesn't exist in orders
  derived_payment_method := CASE 
    WHEN NEW.payment_id IS NOT NULL AND NEW.payment_id != '' THEN 'RAZORPAY'
    WHEN NEW.payment_status IN ('paid_cod', 'cod_collected') THEN 'COD'
    WHEN NEW.payment_status IN ('paid_online', 'paid') THEN 'ONLINE'
    ELSE 'COD'
  END;
  
  -- Insert or update payment transaction record
  INSERT INTO public.payment_transactions (
    order_id,
    payment_id,
    customer_name,
    customer_phone,
    agent_name,
    amount,
    payment_status,
    payment_method,
    order_status,
    delivered,
    transaction_date
  ) VALUES (
    NEW.id,
    COALESCE(NEW.payment_id, 'cod_' || extract(epoch from now())::bigint),
    NEW.customer_name,
    NEW.customer_phone,
    (SELECT name FROM delivery_agents WHERE id = NEW.agent_id),
    NEW.total,
    COALESCE(NEW.payment_status, 'pending'),
    derived_payment_method,
    NEW.status,
    COALESCE(NEW.delivered, false),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (order_id) DO UPDATE SET
    payment_id = COALESCE(EXCLUDED.payment_id, payment_transactions.payment_id),
    customer_name = COALESCE(EXCLUDED.customer_name, payment_transactions.customer_name),
    customer_phone = COALESCE(EXCLUDED.customer_phone, payment_transactions.customer_phone),
    agent_name = COALESCE(EXCLUDED.agent_name, payment_transactions.agent_name),
    amount = EXCLUDED.amount,
    payment_status = EXCLUDED.payment_status,
    payment_method = EXCLUDED.payment_method,
    order_status = EXCLUDED.order_status,
    delivered = EXCLUDED.delivered,
    updated_at = now();
    
  RETURN NEW;
END;
$function$;

-- Recreate the triggers
CREATE TRIGGER sync_payment_on_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_transaction();

CREATE TRIGGER sync_payment_on_order_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_transaction();

-- Fix create_delivery_history_on_delivered function
DROP FUNCTION IF EXISTS create_delivery_history_on_delivered() CASCADE;

CREATE OR REPLACE FUNCTION public.create_delivery_history_on_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  derived_payment_method TEXT;
BEGIN
  IF NEW.status = 'delivered' AND (OLD IS NULL OR OLD.status != 'delivered') THEN
    -- Derive payment method from payment_status
    derived_payment_method := CASE 
      WHEN NEW.payment_status IN ('paid_cod', 'cod_collected') THEN 'COD'
      WHEN NEW.payment_status IN ('paid_online', 'paid') THEN 'Online'
      ELSE 'COD'
    END;
    
    INSERT INTO delivery_history (
      order_id,
      agent_id,
      customer_name,
      customer_phone,
      delivery_address,
      items,
      total_amount,
      payment_status,
      payment_method,
      delivery_time_slot,
      special_instructions,
      delivery_date,
      completed_at,
      delivery_payout,
      agent_location,
      distance_traveled
    ) VALUES (
      NEW.id,
      NEW.agent_id,
      COALESCE((NEW.address->>'fullName')::text, 'Customer'),
      COALESCE((NEW.address->>'phone')::text, ''),
      NEW.address,
      NEW.items,
      NEW.total,
      NEW.payment_status,
      derived_payment_method,
      NEW.delivery_time_slot,
      NEW.special_instructions,
      CURRENT_DATE,
      NOW(),
      0,
      NULL,
      0
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_create_delivery_history_on_delivered
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_delivery_history_on_delivered();