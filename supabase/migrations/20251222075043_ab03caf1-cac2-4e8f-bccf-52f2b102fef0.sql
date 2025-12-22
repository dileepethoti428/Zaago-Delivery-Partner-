CREATE OR REPLACE FUNCTION public.create_delivery_history_on_delivered()
RETURNS trigger
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
    )
    ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;