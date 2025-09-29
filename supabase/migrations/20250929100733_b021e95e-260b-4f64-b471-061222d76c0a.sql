-- Create delivery completions table to bypass orders table triggers
CREATE TABLE public.delivery_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  payment_method TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  customer_location JSONB,
  agent_location JSONB,
  distance_km NUMERIC DEFAULT 0,
  payout_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.delivery_completions ENABLE ROW LEVEL SECURITY;

-- Agents can view their own completions
CREATE POLICY "Agents can view own completions" ON public.delivery_completions
FOR SELECT USING (
  agent_id IN (
    SELECT id FROM delivery_agents 
    WHERE email = auth.email() AND is_active = true
  )
);

-- Agents can create their own completions
CREATE POLICY "Agents can create own completions" ON public.delivery_completions
FOR INSERT WITH CHECK (
  agent_id IN (
    SELECT id FROM delivery_agents 
    WHERE email = auth.email() AND is_active = true
  )
);

-- Admins can manage all completions
CREATE POLICY "Admins can manage all completions" ON public.delivery_completions
FOR ALL USING (is_current_user_admin_v2());

-- System can create completions
CREATE POLICY "System can create completions" ON public.delivery_completions
FOR INSERT WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_delivery_completions_order_id ON public.delivery_completions(order_id);
CREATE INDEX idx_delivery_completions_agent_id ON public.delivery_completions(agent_id);
CREATE INDEX idx_delivery_completions_completed_at ON public.delivery_completions(completed_at);

-- Create trigger for updated_at
CREATE TRIGGER update_delivery_completions_updated_at
  BEFORE UPDATE ON public.delivery_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();