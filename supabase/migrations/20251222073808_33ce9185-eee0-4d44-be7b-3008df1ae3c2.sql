-- Remove duplicate delivery_history entries (keep the one with max id per order_id)
DELETE FROM public.delivery_history
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY id DESC) as rn
        FROM public.delivery_history
    ) t
    WHERE rn > 1
);

-- Add unique constraint on order_id for ON CONFLICT support
CREATE UNIQUE INDEX IF NOT EXISTS unique_delivery_history_order_id 
ON public.delivery_history (order_id);