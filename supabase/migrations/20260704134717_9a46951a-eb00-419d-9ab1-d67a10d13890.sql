CREATE OR REPLACE FUNCTION public.verify_delivery_otp(p_order_id uuid, p_otp text, p_agent_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_expected text;
  v_recent_fails int;
BEGIN
  IF p_otp IS NULL OR length(p_otp) <> 4 THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP must be 4 digits');
  END IF;

  SELECT id, user_id, status, otp_verified
    INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- Idempotent: if already verified or already delivered, return success
  IF v_order.otp_verified = true OR v_order.status = 'delivered' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already verified');
  END IF;

  -- Lockout: 5 failed attempts in 15 min per customer
  SELECT count(*) INTO v_recent_fails
  FROM public.delivery_otp_attempts
  WHERE user_id = v_order.user_id
    AND success = false
    AND attempted_at > now() - interval '15 minutes';

  IF v_recent_fails >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Too many failed attempts. Try again in 15 minutes.',
      'locked', true
    );
  END IF;

  SELECT delivery_otp INTO v_expected
  FROM public.profiles
  WHERE user_id = v_order.user_id;

  IF v_expected IS NULL OR v_expected <> p_otp THEN
    INSERT INTO public.delivery_otp_attempts (user_id, order_id, success)
    VALUES (v_order.user_id, p_order_id, false);

    RETURN jsonb_build_object(
      'success', false,
      'message', 'Incorrect OTP',
      'attempts_remaining', greatest(0, 5 - (v_recent_fails + 1))
    );
  END IF;

  -- OTP correct: mark verified ONLY. Do NOT mark delivered here — the
  -- completion pipeline (complete_delivery_zepto via unified-complete-delivery)
  -- must run so delivery_history, agent_earnings_tracking and payout are
  -- recorded correctly.
  UPDATE public.orders
     SET otp_verified = true,
         updated_at = now()
   WHERE id = p_order_id;

  INSERT INTO public.delivery_otp_attempts (user_id, order_id, success)
  VALUES (v_order.user_id, p_order_id, true);

  RETURN jsonb_build_object('success', true, 'message', 'OTP verified');
END;
$function$;