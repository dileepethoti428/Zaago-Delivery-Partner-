-- Create withdrawal requests table
CREATE TABLE IF NOT EXISTS public.agent_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES delivery_agents(id),
  bank_id UUID NOT NULL REFERENCES agent_bank_details(id),
  amount NUMERIC NOT NULL CHECK (amount >= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create auto-pay settings table  
CREATE TABLE IF NOT EXISTS public.agent_autopay_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES delivery_agents(id) UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  minimum_balance NUMERIC NOT NULL DEFAULT 500,
  topup_amount NUMERIC NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_autopay_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for withdrawal requests
CREATE POLICY "Agents can view own withdrawal requests" ON public.agent_withdrawal_requests
  FOR SELECT USING (agent_id IN (
    SELECT id FROM delivery_agents WHERE email = auth.email() AND is_active = true
  ));

CREATE POLICY "Agents can create withdrawal requests" ON public.agent_withdrawal_requests
  FOR INSERT WITH CHECK (agent_id IN (
    SELECT id FROM delivery_agents WHERE email = auth.email() AND is_active = true
  ));

CREATE POLICY "Admins can manage all withdrawal requests" ON public.agent_withdrawal_requests
  FOR ALL USING (is_current_user_admin_v2());

-- RLS policies for autopay settings
CREATE POLICY "Agents can manage own autopay settings" ON public.agent_autopay_settings
  FOR ALL USING (agent_id IN (
    SELECT id FROM delivery_agents WHERE email = auth.email() AND is_active = true
  ));

CREATE POLICY "Admins can view all autopay settings" ON public.agent_autopay_settings
  FOR SELECT USING (is_current_user_admin_v2());

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_withdrawal_requests_updated_at
    BEFORE UPDATE ON public.agent_withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_autopay_settings_updated_at
    BEFORE UPDATE ON public.agent_autopay_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();