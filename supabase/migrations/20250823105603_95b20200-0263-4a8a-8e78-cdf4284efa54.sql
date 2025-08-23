-- Fix trigger issue causing delivery failures
-- Drop misplaced trigger from delivery_history table
DROP TRIGGER IF EXISTS notify_seller_on_delivery ON public.delivery_history CASCADE;

-- Ensure trigger exists on orders table for notifications
DROP TRIGGER IF EXISTS notify_seller_on_delivery ON public.orders CASCADE;

-- Create proper trigger on orders table
CREATE TRIGGER notify_seller_on_delivery
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    WHEN (NEW.status = 'delivered' AND COALESCE(OLD.status, '') IS DISTINCT FROM 'delivered')
    EXECUTE FUNCTION public.notify_seller_on_delivery();