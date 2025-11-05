-- Create flexible_payment_requests table
CREATE TABLE IF NOT EXISTS public.flexible_payment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES delivery_agents(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'generated', 'failed')),
  qr_url TEXT,
  payment_id UUID,
  error_message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flexible_payment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agents can insert own payment requests"
  ON public.flexible_payment_requests
  FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM delivery_agents 
      WHERE email = auth.email() AND is_active = true
    )
  );

CREATE POLICY "Agents can view own payment requests"
  ON public.flexible_payment_requests
  FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM delivery_agents 
      WHERE email = auth.email() AND is_active = true
    )
  );

CREATE POLICY "Admins can manage all payment requests"
  ON public.flexible_payment_requests
  FOR ALL
  USING (is_current_user_admin_v2());

CREATE POLICY "System can update payment requests"
  ON public.flexible_payment_requests
  FOR UPDATE
  USING (true);

-- Create index for polling
CREATE INDEX idx_flexible_payment_requests_agent_status 
  ON public.flexible_payment_requests(agent_id, status, created_at DESC);

-- Update timestamp trigger
CREATE TRIGGER update_flexible_payment_requests_updated_at
  BEFORE UPDATE ON public.flexible_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();