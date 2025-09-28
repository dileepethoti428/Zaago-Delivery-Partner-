-- Create a simple, direct delivery completion function without session modifications
CREATE OR REPLACE FUNCTION simple_complete_delivery_final(
    p_order_id uuid,
    p_payment_method text DEFAULT 'Online'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    affected_rows INTEGER;
    current_status TEXT;
BEGIN
    -- First check if order exists and get current status
    SELECT status INTO current_status
    FROM orders 
    WHERE id = p_order_id;
    
    IF current_status IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found'
        );
    END IF;
    
    IF current_status = 'delivered' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Order already delivered',
            'order_id', p_order_id
        );
    END IF;
    
    -- Simple direct update with explicit field setting to avoid JSON processing issues
    BEGIN
        UPDATE orders 
        SET 
            status = 'delivered',
            delivered_at = now(),
            payment_status = CASE 
                WHEN p_payment_method = 'COD' THEN 'paid_cod'
                ELSE 'paid_online'
            END,
            updated_at = now()
        WHERE id = p_order_id
        AND status IN ('assigned', 'packed', 'out_for_delivery');
        
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        
        IF affected_rows > 0 THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Delivery completed successfully',
                'order_id', p_order_id,
                'payment_method', p_payment_method
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Order not found or not in valid status for completion'
            );
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log the error for debugging but return a user-friendly message
        INSERT INTO password_reset_logs (
            email,
            event_type,
            metadata,
            error
        ) VALUES (
            'system@zaago.com',
            'email_sent',
            jsonb_build_object(
                'action', 'delivery_completion_error',
                'order_id', p_order_id,
                'payment_method', p_payment_method,
                'error_time', now()
            ),
            SQLERRM
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unable to complete delivery due to database constraints',
            'details', 'Please contact support if this persists'
        );
    END;
END;
$function$;