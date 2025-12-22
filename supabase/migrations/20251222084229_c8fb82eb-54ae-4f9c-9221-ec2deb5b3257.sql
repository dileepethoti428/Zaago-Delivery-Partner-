-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS public.manual_complete_delivery(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.qr_complete_delivery_v3(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.simple_mark_delivered(uuid, uuid, text);

-- 1. Recreate manual_complete_delivery function
CREATE OR REPLACE FUNCTION public.manual_complete_delivery(
    p_order_id uuid,
    p_agent_id uuid,
    p_payment_method text DEFAULT 'COD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_history_id uuid;
    v_payout_amount numeric;
    v_distance_km numeric;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status = 'delivered' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Order already delivered', 'already_delivered', true);
    END IF;
    
    v_distance_km := COALESCE(v_order.distance_km, 2.0);
    v_payout_amount := CASE 
        WHEN v_distance_km <= 2 THEN 15
        WHEN v_distance_km <= 5 THEN 20
        WHEN v_distance_km <= 10 THEN 30
        ELSE 40
    END;
    
    INSERT INTO delivery_history (
        order_id, agent_id, customer_name, customer_phone,
        delivery_address, items, total_amount, payment_method,
        payment_status, delivery_date, completed_at, distance_traveled, delivery_payout
    ) VALUES (
        p_order_id, p_agent_id,
        COALESCE(v_order.customer_name, 'Customer'),
        v_order.customer_phone,
        COALESCE(v_order.delivery_address, '{}'::jsonb),
        COALESCE(v_order.items, '[]'::jsonb),
        COALESCE(v_order.total_amount, 0),
        UPPER(p_payment_method),
        'paid',
        CURRENT_DATE, NOW(), v_distance_km, v_payout_amount
    )
    RETURNING id INTO v_history_id;
    
    UPDATE orders SET status = 'delivered', delivered_at = NOW(), updated_at = NOW() WHERE id = p_order_id;
    
    UPDATE delivery_agents SET
        total_deliveries = COALESCE(total_deliveries, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
        last_delivery_at = NOW(), updated_at = NOW()
    WHERE id = p_agent_id;
    
    RETURN jsonb_build_object('success', true, 'history_id', v_history_id, 'payout_amount', v_payout_amount, 'distance_km', v_distance_km);
END;
$$;

-- 2. Recreate qr_complete_delivery_v3 function
CREATE OR REPLACE FUNCTION public.qr_complete_delivery_v3(
    p_order_id uuid,
    p_agent_id uuid,
    p_payment_method text DEFAULT 'COD',
    p_qr_code_data text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_history_id uuid;
    v_payout_amount numeric;
    v_distance_km numeric;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status = 'delivered' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Order already delivered', 'already_delivered', true);
    END IF;
    
    v_distance_km := COALESCE(v_order.distance_km, 2.0);
    v_payout_amount := CASE 
        WHEN v_distance_km <= 2 THEN 15
        WHEN v_distance_km <= 5 THEN 20
        WHEN v_distance_km <= 10 THEN 30
        ELSE 40
    END;
    
    INSERT INTO delivery_history (
        order_id, agent_id, customer_name, customer_phone,
        delivery_address, items, total_amount, payment_method,
        payment_status, delivery_date, completed_at, distance_traveled, delivery_payout
    ) VALUES (
        p_order_id, p_agent_id,
        COALESCE(v_order.customer_name, 'Customer'),
        v_order.customer_phone,
        COALESCE(v_order.delivery_address, '{}'::jsonb),
        COALESCE(v_order.items, '[]'::jsonb),
        COALESCE(v_order.total_amount, 0),
        UPPER(p_payment_method),
        'paid',
        CURRENT_DATE, NOW(), v_distance_km, v_payout_amount
    )
    RETURNING id INTO v_history_id;
    
    UPDATE orders SET status = 'delivered', delivered_at = NOW(), payment_status = 'paid', updated_at = NOW() WHERE id = p_order_id;
    
    UPDATE delivery_agents SET
        total_deliveries = COALESCE(total_deliveries, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
        last_delivery_at = NOW(), updated_at = NOW()
    WHERE id = p_agent_id;
    
    IF p_qr_code_data IS NOT NULL THEN
        UPDATE order_qr_codes SET is_scanned = true, scanned_at = NOW() WHERE qr_code_data = p_qr_code_data;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'history_id', v_history_id, 'payout_amount', v_payout_amount, 'distance_km', v_distance_km, 'payment_status', 'paid');
END;
$$;

-- 3. Recreate simple_mark_delivered function
CREATE OR REPLACE FUNCTION public.simple_mark_delivered(
    p_order_id uuid,
    p_agent_id uuid,
    p_payment_method text DEFAULT 'COD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_history_id uuid;
    v_payout_amount numeric := 15;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    IF v_order.status = 'delivered' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already delivered', 'already_delivered', true);
    END IF;
    
    INSERT INTO delivery_history (
        order_id, agent_id, customer_name, customer_phone,
        delivery_address, items, total_amount, payment_method,
        payment_status, delivery_date, completed_at, delivery_payout
    ) VALUES (
        p_order_id, p_agent_id,
        COALESCE(v_order.customer_name, 'Customer'),
        v_order.customer_phone,
        COALESCE(v_order.delivery_address, '{}'::jsonb),
        COALESCE(v_order.items, '[]'::jsonb),
        COALESCE(v_order.total_amount, 0),
        UPPER(p_payment_method),
        'paid',
        CURRENT_DATE, NOW(), v_payout_amount
    )
    RETURNING id INTO v_history_id;
    
    UPDATE orders SET status = 'delivered', payment_status = 'paid', delivered_at = NOW(), updated_at = NOW() WHERE id = p_order_id;
    
    UPDATE delivery_agents SET
        total_deliveries = COALESCE(total_deliveries, 0) + 1,
        total_earnings = COALESCE(total_earnings, 0) + v_payout_amount,
        last_delivery_at = NOW()
    WHERE id = p_agent_id;
    
    RETURN jsonb_build_object('success', true, 'history_id', v_history_id);
END;
$$;

-- 4. Fix existing pending records
UPDATE delivery_history SET payment_status = 'paid' WHERE payment_status = 'pending';