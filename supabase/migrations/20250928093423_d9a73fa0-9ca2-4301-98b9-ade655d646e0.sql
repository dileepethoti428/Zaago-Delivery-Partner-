-- Create a simple function to complete delivery without JSON validation issues
CREATE OR REPLACE FUNCTION complete_delivery_minimal_update(
    p_order_id uuid,
    p_payment_method text DEFAULT 'Online'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Simple direct update without triggering complex validation
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
    
    -- Return true if row was updated
    RETURN FOUND;
END;
$function$;