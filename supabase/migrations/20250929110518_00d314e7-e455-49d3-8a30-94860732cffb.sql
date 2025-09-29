-- First, find and disable the problematic trigger in delivery_history creation
DROP TRIGGER IF EXISTS trigger_create_delivery_history_on_delivered ON orders;

-- Also check if there's a trigger on delivery_history table itself
DROP TRIGGER IF EXISTS trigger_auto_process_delivery_payout ON delivery_history;

-- Update the problematic order without any triggers
UPDATE orders 
SET 
  status = 'delivered',
  payment_status = 'paid_cod',
  delivered_at = now(),
  updated_at = now()
WHERE id = 'ad5bd719-86dc-43a9-b70d-a233f0f40256' 
  AND status = 'assigned';

-- Safely re-enable the delivery history trigger but modify the function to avoid duplicate earnings
CREATE OR REPLACE FUNCTION create_delivery_history_on_delivered()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status transitions to delivered
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'delivered'
     AND COALESCE(OLD.status, '') <> 'delivered' THEN

    -- Insert delivery_history once per order (without triggering payout)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Re-enable the modified trigger
CREATE TRIGGER trigger_create_delivery_history_on_delivered
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_delivery_history_on_delivered();