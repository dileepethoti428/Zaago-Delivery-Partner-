-- Create flexible_payments table for tracking custom payment QRs
CREATE TABLE IF NOT EXISTS public.flexible_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount >= 10 AND amount <= 50000),
  razorpay_qr_id TEXT NOT NULL,
  qr_code_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  payment_received_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_flexible_payments_agent_id ON public.flexible_payments(agent_id);
CREATE INDEX IF NOT EXISTS idx_flexible_payments_status ON public.flexible_payments(status);
CREATE INDEX IF NOT EXISTS idx_flexible_payments_razorpay_qr_id ON public.flexible_payments(razorpay_qr_id);

-- Enable RLS
ALTER TABLE public.flexible_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agents can view their own flexible payments"
  ON public.flexible_payments
  FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM delivery_agents 
      WHERE email = auth.email() AND is_active = true
    )
  );

CREATE POLICY "Admins can view all flexible payments"
  ON public.flexible_payments
  FOR ALL
  USING (is_current_user_admin_v2());

CREATE POLICY "System can manage flexible payments"
  ON public.flexible_payments
  FOR ALL
  USING (true)
  WITH CHECK (true);