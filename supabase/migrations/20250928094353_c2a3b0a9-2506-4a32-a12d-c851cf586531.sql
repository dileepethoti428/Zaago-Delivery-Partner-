-- Create a completely isolated delivery completion function that bypasses all triggers
CREATE OR REPLACE FUNCTION bypass_complete_delivery_direct(
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
BEGIN
    -- Direct SQL update with minimal processing - bypass triggers temporarily
    SET session_replication_role = replica;
    
    -- Simple direct update without any JSON processing
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
    
    -- Re-enable triggers
    SET session_replication_role = DEFAULT;
    
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
    -- Re-enable triggers in case of error
    SET session_replication_role = DEFAULT;
    
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'details', 'Database error during delivery completion'
    );
END;
$function$;