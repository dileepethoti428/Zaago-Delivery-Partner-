-- Fix UUID casting issues in completion functions
-- Add explicit ::uuid casts wherever p_order_id (text) is used against UUID columns

CREATE OR REPLACE FUNCTION public.manual_complete_delivery(p_order_id text, p_agent_id uuid, p_payment_method text DEFAULT 'COD'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order RECORD;
    v_distance_km NUMERIC;
    v_payout_amount NUMERIC;
    v_payment_status TEXT;
    v_existing_delivery UUID;
BEGIN
    -- Check if already delivered (FIXED: added ::uuid cast)
    SELECT id INTO v_existing_delivery
    FROM delivery_history
    WHERE order_id = p_order_id::uuid AND agent_id = p_agent_id
    LIMIT 1;

    IF v_existing_delivery IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'message', 'Order already completed',
            'payout_amount', 30
        );
    END IF;

    -- Get order details (FIXED: added ::uuid cast)
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id::uuid AND agent_id = p_agent_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found or not assigned to agent'
        );
    END IF;

    -- Use default distance for payout calculation
    v_distance_km := 5;
    v_payout_amount := 30;
    v_payment_status := CASE WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'paid' ELSE 'pending' END;

    -- Insert delivery history (FIXED: added ::uuid cast)
    INSERT INTO delivery_history (
        order_id, agent_id, customer_name, customer_phone,
        pickup_address, delivery_address, distance_km, payout_amount,
        payment_method, payment_status
    ) VALUES (
        p_order_id::uuid, p_agent_id, v_order.customer_name, v_order.customer_phone,
        v_order.pickup_address, v_order.delivery_address, v_distance_km, v_payout_amount,
        p_payment_method, v_payment_status
    );

    -- Update order status (FIXED: added ::uuid cast)
    UPDATE orders
    SET status = 'delivered',
        delivered_at = NOW()
    WHERE id = p_order_id::uuid;

    -- Update agent stats
    UPDATE delivery_agents
    SET total_deliveries = total_deliveries + 1,
        total_earnings = total_earnings + v_payout_amount
    WHERE id = p_agent_id;

    -- Create wallet transaction
    INSERT INTO agent_wallet_transactions (agent_id, amount, transaction_type, description)
    VALUES (p_agent_id, v_payout_amount, 'earning', 'Delivery payout for order ' || p_order_id);

    -- Update wallet balance
    INSERT INTO agent_wallet (agent_id, balance)
    VALUES (p_agent_id, v_payout_amount)
    ON CONFLICT (agent_id)
    DO UPDATE SET balance = agent_wallet.balance + v_payout_amount;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Delivery completed successfully',
        'payout_amount', v_payout_amount,
        'already_completed', false
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.simple_mark_delivered(p_order_id text, p_agent_id uuid, p_payment_method text DEFAULT 'COD'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order RECORD;
    v_payout_amount NUMERIC := 30;
    v_payment_status TEXT;
    v_existing_delivery UUID;
BEGIN
    -- Check if already delivered (FIXED: added ::uuid cast)
    SELECT id INTO v_existing_delivery
    FROM delivery_history
    WHERE order_id = p_order_id::uuid AND agent_id = p_agent_id
    LIMIT 1;

    IF v_existing_delivery IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_completed', true,
            'message', 'Order already completed',
            'payout_amount', 30
        );
    END IF;

    -- Get order details (FIXED: added ::uuid cast)
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id::uuid AND agent_id = p_agent_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found or not assigned to agent'
        );
    END IF;

    v_payment_status := CASE WHEN UPPER(p_payment_method) = 'ONLINE' THEN 'paid' ELSE 'pending' END;

    -- Insert delivery history (FIXED: added ::uuid cast)
    INSERT INTO delivery_history (
        order_id, agent_id, customer_name, customer_phone,
        pickup_address, delivery_address, distance_km, payout_amount,
        payment_method, payment_status
    ) VALUES (
        p_order_id::uuid, p_agent_id, v_order.customer_name, v_order.customer_phone,
        v_order.pickup_address, v_order.delivery_address, 5, v_payout_amount,
        p_payment_method, v_payment_status
    );

    -- Update order status (FIXED: added ::uuid cast)
    UPDATE orders
    SET status = 'delivered',
        delivered_at = NOW()
    WHERE id = p_order_id::uuid;

    -- Update agent stats
    UPDATE delivery_agents
    SET total_deliveries = total_deliveries + 1,
        total_earnings = total_earnings + v_payout_amount
    WHERE id = p_agent_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Delivery marked as delivered',
        'payout_amount', v_payout_amount,
        'already_completed', false
    );
END;
$function$;