-- =====================================================
-- FIX: Sync orders.status with delivery_history completions
-- =====================================================

-- STEP 1: One-time cleanup - Mark orders as delivered if they exist in delivery_history
-- This fixes existing "stuck" orders that show as active but are actually completed
UPDATE public.orders o
SET 
  status = 'delivered',
  delivered_at = dh.completed_at,
  updated_at = NOW()
FROM public.delivery_history dh
WHERE o.id = dh.order_id
AND o.status NOT IN ('delivered', 'completed', 'cancelled', 'canceled');

-- STEP 2: Create trigger function to auto-update orders.status when delivery_history is inserted
CREATE OR REPLACE FUNCTION public.sync_order_status_on_delivery_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Update orders table when a delivery is completed (logged in delivery_history)
  UPDATE public.orders
  SET 
    status = 'delivered',
    delivered_at = COALESCE(NEW.completed_at, NOW()),
    updated_at = NOW()
  WHERE id = NEW.order_id
  AND status NOT IN ('delivered', 'completed', 'cancelled', 'canceled');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 3: Create trigger on delivery_history table
DROP TRIGGER IF EXISTS trigger_sync_order_status_on_delivery ON public.delivery_history;

CREATE TRIGGER trigger_sync_order_status_on_delivery
AFTER INSERT ON public.delivery_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_status_on_delivery_history();