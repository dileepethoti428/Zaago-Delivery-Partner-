-- Create withdrawal_requests table to track all withdrawal transactions
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES delivery_agents(id),
  bank_id UUID NOT NULL REFERENCES agent_bank_details(id),
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transfer_reference TEXT UNIQUE,
  razorpay_transaction_id TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  admin_notes TEXT,
  failure_reason TEXT
);

-- Enable RLS on withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for withdrawal_requests
CREATE POLICY "agents_can_view_own_withdrawals" ON public.withdrawal_requests
  FOR SELECT
  USING (agent_id IN (
    SELECT id FROM delivery_agents 
    WHERE email = auth.email() AND is_active = true
  ));

CREATE POLICY "admins_can_manage_all_withdrawals" ON public.withdrawal_requests
  FOR ALL
  USING (is_current_user_admin_v2());

CREATE POLICY "system_can_create_withdrawals" ON public.withdrawal_requests
  FOR INSERT
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_withdrawal_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_withdrawal_requests_updated_at();