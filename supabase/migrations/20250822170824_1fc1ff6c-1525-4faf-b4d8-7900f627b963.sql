
-- Safety net: ensure delivery_history is created when an order is marked delivered

CREATE OR REPLACE FUNCTION public.create_delivery_history_on_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when status transitions to delivered
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'delivered'
     AND COALESCE(OLD.status, '') <> 'delivered' THEN

    -- Insert delivery_history once per order
    IF NOT EXISTS (
      SELECT 1 FROM public.delivery_history dh WHERE dh.order_id = NEW.id
    ) THEN
      INSERT INTO public.delivery_history (
        order_id,
        agent_id,
        customer_name,
        customer_phone,
        delivery_address,
        items,
        total_amount,
        payment_method,
        payment_status,
        delivery_date,
        completed_at,
        special_instructions,
        delivery_time_slot,
        distance_traveled,
        delivery_payout,
        agent_location
      )
      VALUES (
        NEW.id,
        NEW.agent_id,
        NEW.customer_name,
        NEW.customer_phone,
        NEW.address,
        NEW.items,
        NEW.total,
        CASE WHEN NEW.payment_status = 'paid_cod' THEN 'COD' ELSE 'Online' END,
        NEW.payment_status,
        COALESCE(NEW.delivered_at::date, CURRENT_DATE),
        COALESCE(NEW.delivered_at, now()),
        NEW.special_instructions,
        NEW.delivery_time_slot,
        NULL,   -- distance_traveled (unknown at this point)
        0,      -- delivery_payout (edge function will compute; this is a fallback)
        NULL    -- agent_location (unknown at this point)
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate trigger on orders to call the function after status updates
DROP TRIGGER IF EXISTS trg_create_history_on_delivered ON public.orders;

CREATE TRIGGER trg_create_history_on_delivered
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'delivered')
EXECUTE FUNCTION public.create_delivery_history_on_delivered();
