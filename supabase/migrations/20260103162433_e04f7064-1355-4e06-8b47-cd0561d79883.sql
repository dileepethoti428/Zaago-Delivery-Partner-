CREATE OR REPLACE FUNCTION public.notify_seller_on_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  product_record RECORD;
  v_body TEXT;
BEGIN
  -- Only trigger when order status changes to delivered
  IF NEW.status = 'delivered' AND (OLD IS NULL OR OLD.status != 'delivered') THEN
    -- Get seller info for each product in the order
    FOR product_record IN
      SELECT DISTINCT p.seller_id, p.name as product_name
      FROM products p
      WHERE p.id IN (
        SELECT (item->>'id')::uuid
        FROM jsonb_array_elements(NEW.items) AS item
      )
    LOOP
      -- Build notification body - ensure it's never null
      v_body := 'Your product "' || COALESCE(product_record.product_name, 'Unknown Product') || '" has been delivered successfully. Payment Status: ' || COALESCE(NEW.payment_status, 'unknown');
      
      INSERT INTO notifications (
        user_id,
        title,
        body,
        message,
        type,
        role,
        order_id
      ) VALUES (
        product_record.seller_id,
        'Product Delivered',
        v_body,
        v_body,
        'delivery',
        'seller',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;