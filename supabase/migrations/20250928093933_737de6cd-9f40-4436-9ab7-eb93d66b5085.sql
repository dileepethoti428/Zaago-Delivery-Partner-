-- Fix the add_seller_id_to_order_items trigger to prevent JSON parsing errors
-- and only run when items are actually changed

CREATE OR REPLACE FUNCTION add_seller_id_to_order_items()
RETURNS TRIGGER AS $$
DECLARE
    updated_items JSONB := '[]'::jsonb;
    item JSONB;
    product_seller_id UUID;
BEGIN
    -- Only process if items field is being changed and is not null
    IF TG_OP = 'UPDATE' AND (OLD.items IS NOT DISTINCT FROM NEW.items OR NEW.items IS NULL) THEN
        RETURN NEW;
    END IF;
    
    -- Only process if items field is being inserted and is not null  
    IF TG_OP = 'INSERT' AND NEW.items IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Add error handling for JSON parsing
    BEGIN
        -- Ensure items is valid JSONB array
        IF jsonb_typeof(NEW.items) != 'array' THEN
            -- If items is not a valid array, return without modification
            RETURN NEW;
        END IF;
        
        -- Process each item in the array
        FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
        LOOP
            -- Skip if item already has seller_id
            IF item ? 'seller_id' THEN
                updated_items := updated_items || item;
                CONTINUE;
            END IF;
            
            -- Skip if item doesn't have id field
            IF NOT (item ? 'id') THEN
                updated_items := updated_items || item;
                CONTINUE;
            END IF;
            
            -- Get seller_id for this product
            SELECT seller_id INTO product_seller_id
            FROM products 
            WHERE id = (item->>'id')::uuid;
            
            -- Add seller_id to item if found
            IF product_seller_id IS NOT NULL THEN
                updated_items := updated_items || jsonb_set(item, '{seller_id}', to_jsonb(product_seller_id));
            ELSE
                updated_items := updated_items || item;
            END IF;
        END LOOP;
        
        -- Update the items with seller_id added
        NEW.items := updated_items;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't break the operation
        INSERT INTO password_reset_logs (
            email,
            event_type,
            metadata,
            error
        ) VALUES (
            'system@zaago.com',
            'email_sent',
            jsonb_build_object(
                'action', 'add_seller_id_trigger_error',
                'order_id', NEW.id,
                'trigger_operation', TG_OP,
                'error_time', now()
            ),
            SQLERRM
        );
        
        -- Return without modification to prevent breaking the main operation
        RETURN NEW;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;