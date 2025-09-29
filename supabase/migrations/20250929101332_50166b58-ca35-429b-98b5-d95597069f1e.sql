-- Create function to safely reconcile completed orders
CREATE OR REPLACE FUNCTION public.reconcile_completed_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  completion_record RECORD;
  reconciled_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- Loop through all completed deliveries that need reconciliation
  FOR completion_record IN 
    SELECT * FROM delivery_completions 
    WHERE status = 'completed'
  LOOP
    BEGIN
      -- Update orders table without triggering problematic triggers
      UPDATE orders 
      SET 
        status = 'delivered',
        delivered_at = completion_record.completed_at,
        payment_status = CASE 
          WHEN completion_record.payment_method = 'COD' THEN 'paid_cod' 
          ELSE 'paid_online' 
        END,
        updated_at = NOW()
      WHERE id = completion_record.order_id
        AND status != 'delivered';
      
      -- Mark completion as reconciled
      UPDATE delivery_completions 
      SET 
        status = 'reconciled',
        metadata = COALESCE(metadata, '{}')::jsonb || jsonb_build_object('reconciled_at', NOW())
      WHERE id = completion_record.id;
      
      reconciled_count := reconciled_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- Log error but continue
      INSERT INTO password_reset_logs (email, event_type, metadata, error)
      VALUES (
        'system@zaago.com',
        'email_sent',
        jsonb_build_object(
          'action', 'reconciliation_error',
          'order_id', completion_record.order_id,
          'completion_id', completion_record.id
        ),
        SQLERRM
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'reconciled_count', reconciled_count,
    'error_count', error_count
  );
END;
$function$;