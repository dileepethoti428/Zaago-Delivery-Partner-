CREATE OR REPLACE FUNCTION public.cancel_agent_earnings_on_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE public.agent_earnings_tracking
    SET payout_status = 'cancelled',
        actual_payout = 0,
        completed_at = COALESCE(completed_at, now()),
        updated_at = now()
    WHERE order_id = NEW.id
      AND payout_status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_agent_earnings_on_order_cancel ON public.orders;
CREATE TRIGGER trg_cancel_agent_earnings_on_order_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.cancel_agent_earnings_on_order_cancel();

CREATE OR REPLACE FUNCTION public.cancel_agent_earnings_on_daily_order_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE public.agent_earnings_tracking
    SET payout_status = 'cancelled',
        actual_payout = 0,
        completed_at = COALESCE(completed_at, now()),
        updated_at = now()
    WHERE daily_order_id = NEW.id
      AND payout_status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_agent_earnings_on_daily_order_cancel ON public.daily_orders;
CREATE TRIGGER trg_cancel_agent_earnings_on_daily_order_cancel
AFTER UPDATE OF status ON public.daily_orders
FOR EACH ROW
EXECUTE FUNCTION public.cancel_agent_earnings_on_daily_order_cancel();

-- Backfill: any tracking row whose order is already cancelled but still marked pending
UPDATE public.agent_earnings_tracking aet
SET payout_status = 'cancelled',
    actual_payout = 0,
    completed_at = COALESCE(aet.completed_at, now()),
    updated_at = now()
FROM public.orders o
WHERE aet.order_id = o.id
  AND o.status = 'cancelled'
  AND aet.payout_status = 'pending';

UPDATE public.agent_earnings_tracking aet
SET payout_status = 'cancelled',
    actual_payout = 0,
    completed_at = COALESCE(aet.completed_at, now()),
    updated_at = now()
FROM public.daily_orders d
WHERE aet.daily_order_id = d.id
  AND d.status = 'cancelled'
  AND aet.payout_status = 'pending';