-- Fix misattached trigger causing NEW.status error
-- 1) Drop wrong trigger from delivery_history
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'notify_seller_on_delivery'
      AND n.nspname = 'public'
      AND c.relname = 'delivery_history'
  ) THEN
    EXECUTE 'DROP TRIGGER notify_seller_on_delivery ON public.delivery_history';
  END IF;
END $$;

-- 2) Ensure trigger exists on orders after status changes to delivered
DO $$
BEGIN
  -- Drop existing trigger on orders if present to recreate with proper WHEN clause
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'notify_seller_on_delivery'
      AND n.nspname = 'public'
      AND c.relname = 'orders'
  ) THEN
    EXECUTE 'DROP TRIGGER notify_seller_on_delivery ON public.orders';
  END IF;
  
  EXECUTE $$
    CREATE TRIGGER notify_seller_on_delivery
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'delivered' AND COALESCE(OLD.status, '') IS DISTINCT FROM 'delivered')
    EXECUTE FUNCTION public.notify_seller_on_delivery();
  $$;
END $$;