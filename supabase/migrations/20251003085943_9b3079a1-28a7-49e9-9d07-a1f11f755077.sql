-- Fix triggers that reference non-existent payment_method column
-- The correct column name is payment_status

-- Drop and recreate notify_seller_on_delivery function to use payment_status
DROP TRIGGER IF EXISTS trigger_notify_seller_on_delivery ON orders CASCADE;
DROP FUNCTION IF EXISTS notify_seller_on_delivery() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_seller_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  product_record RECORD;
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
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        role,
        order_id
      ) VALUES (
        product_record.seller_id,
        'Product Delivered',
        'Your product "' || product_record.product_name || '" has been delivered successfully. Payment Status: ' || NEW.payment_status,
        'delivery',
        'seller',
        NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_notify_seller_on_delivery
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_seller_on_delivery();

-- Ensure update_product_stock_after_order also uses payment_status correctly
DROP TRIGGER IF EXISTS trigger_update_product_stock_after_order ON orders CASCADE;
DROP FUNCTION IF EXISTS update_product_stock_after_order() CASCADE;

CREATE OR REPLACE FUNCTION public.update_product_stock_after_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    item JSONB;
    product_record RECORD;
BEGIN
    -- Only process when order status changes to 'placed' or 'confirmed'
    IF NEW.status IN ('placed', 'confirmed') AND (OLD IS NULL OR OLD.status != NEW.status) THEN
        -- Loop through each item in the order
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            -- Get current product stock
            SELECT id, stock_quantity, name INTO product_record
            FROM products 
            WHERE id = (item->>'id')::uuid;
            
            IF FOUND THEN
                -- Update stock quantity
                UPDATE products 
                SET 
                    stock_quantity = GREATEST(0, stock_quantity - (item->>'quantity')::integer),
                    updated_at = now()
                WHERE id = product_record.id;
                
                -- Log stock update
                INSERT INTO password_reset_logs (
                    email,
                    event_type,
                    metadata
                ) VALUES (
                    'system@zaago.com',
                    'email_sent',
                    jsonb_build_object(
                        'action', 'stock_updated',
                        'product_id', product_record.id,
                        'product_name', product_record.name,
                        'order_id', NEW.id,
                        'quantity_ordered', (item->>'quantity')::integer,
                        'previous_stock', product_record.stock_quantity,
                        'new_stock', GREATEST(0, product_record.stock_quantity - (item->>'quantity')::integer),
                        'payment_status', NEW.payment_status
                    )
                );
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_update_product_stock_after_order
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_after_order();