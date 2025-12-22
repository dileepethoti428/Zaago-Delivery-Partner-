-- Fix delivery completion idempotency: remove conflicting unique index and use existing (order_id, agent_id) constraint

-- 1) Drop the mistakenly-added unique index on order_id (conflicts with existing unique_order_delivery)
DROP INDEX IF EXISTS public.unique_delivery_history_order_id;

-- 2) Update manual_complete_delivery to handle conflicts using the correct constraint
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_order RECORD;
    v_agent RECORD;
    v_payout_amount NUMERIC;
    v_history_id UUID;
    v_rows_inserted INTEGER;
BEGIN
    -- Early duplicate check
    IF EXISTS (
        SELECT 1 FROM delivery_history 
        WHERE order_id = p_order_id
    ) THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Order already completed',
            'already_completed', true,
            'payout_amount', 0
        );
    END IF;

    -- Fetch order details
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Fetch agent details
    SELECT * INTO v_agent FROM delivery_agents WHERE id = p_agent_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found';
    END IF;

    -- Calculate payout
    SELECT delivery_payout INTO v_payout_amount
    FROM orders
    WHERE id = p_order_id;

    -- Insert into delivery_history with correct conflict handling
    INSERT INTO delivery_history (
        order_id,
        agent_id,
        customer_name,
        customer_phone,
        delivery_address,
        items,
        total_amount,
        payment_method,
        payment_status,
        delivery_payout,
        delivery_date,
        completed_at
    )
    VALUES (
        p_order_id,
        p_agent_id,
        v_order.customer_name,
        v_order.customer_phone,
        v_order.address,
        v_order.items,
        v_order.total,
        p_payment_method,
        CASE 
            WHEN v_order.payment_status = 'paid' THEN 'paid'
            WHEN p_payment_method = 'ONLINE' THEN 'paid'
            ELSE 'pending'
        END,
        v_payout_amount,
        CURRENT_DATE,
        NOW()
    )
    ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING
    RETURNING id INTO v_history_id;

    -- Validate insertion
    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
    
    IF v_rows_inserted = 0 THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Order already completed',
            'already_completed', true,
            'payout_amount', 0
        );
    END IF;

    -- Update order status
    UPDATE orders
    SET 
        status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Update agent stats
    UPDATE delivery_agents
    SET 
        total_deliveries = COALESCE(total_deliveries, 0) + 1,
        deliveries_today = COALESCE(deliveries_today, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + COALESCE(v_payout_amount, 0),
        last_delivery_at = NOW(),
        updated_at = NOW()
    WHERE id = p_agent_id;

    -- Update earnings tracking
    UPDATE agent_earnings_tracking
    SET 
        actual_payout = v_payout_amount,
        completed_at = NOW(),
        payout_status = 'completed',
        payment_method = p_payment_method,
        updated_at = NOW()
    WHERE order_id = p_order_id AND agent_id = p_agent_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Delivery completed successfully',
        'payout_amount', v_payout_amount,
        'already_completed', false
    );
END;
$function$;

-- 3) Update simple_mark_delivered to handle conflicts using the correct constraint
CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
  p_order_id uuid,
  p_agent_id uuid,
  p_payment_method text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_order RECORD;
    v_payout_amount NUMERIC;
    v_rows_inserted INTEGER;
BEGIN
    -- Early duplicate check
    IF EXISTS (
        SELECT 1 FROM delivery_history 
        WHERE order_id = p_order_id
    ) THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Order already marked as delivered',
            'already_completed', true,
            'payout_amount', 0
        );
    END IF;

    -- Fetch order details
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Calculate payout
    SELECT delivery_payout INTO v_payout_amount
    FROM orders
    WHERE id = p_order_id;

    -- Insert into delivery_history with correct conflict handling
    INSERT INTO delivery_history (
        order_id,
        agent_id,
        customer_name,
        customer_phone,
        delivery_address,
        items,
        total_amount,
        payment_method,
        payment_status,
        delivery_payout,
        delivery_date,
        completed_at
    )
    VALUES (
        p_order_id,
        p_agent_id,
        v_order.customer_name,
        v_order.customer_phone,
        v_order.address,
        v_order.items,
        v_order.total,
        p_payment_method,
        CASE 
            WHEN v_order.payment_status = 'paid' THEN 'paid'
            WHEN p_payment_method = 'ONLINE' THEN 'paid'
            ELSE 'pending'
        END,
        v_payout_amount,
        CURRENT_DATE,
        NOW()
    )
    ON CONFLICT ON CONSTRAINT unique_order_delivery DO NOTHING;

    -- Validate insertion
    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
    
    IF v_rows_inserted = 0 THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Order already marked as delivered',
            'already_completed', true,
            'payout_amount', 0
        );
    END IF;

    -- Update order status
    UPDATE orders
    SET 
        status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Update agent stats
    UPDATE delivery_agents
    SET 
        total_deliveries = COALESCE(total_deliveries, 0) + 1,
        deliveries_today = COALESCE(deliveries_today, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + COALESCE(v_payout_amount, 0),
        last_delivery_at = NOW(),
        updated_at = NOW()
    WHERE id = p_agent_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Order marked as delivered',
        'payout_amount', v_payout_amount,
        'already_completed', false
    );
END;
$function$;
