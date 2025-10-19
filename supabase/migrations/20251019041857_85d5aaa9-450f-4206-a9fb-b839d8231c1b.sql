-- Create table to track agent order rejections
CREATE TABLE IF NOT EXISTS public.agent_order_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rejection_reason TEXT,
  rejection_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'cancelled', 'timeout'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, order_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_order_rejections_agent 
  ON public.agent_order_rejections(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_order_rejections_order 
  ON public.agent_order_rejections(order_id);

-- Enable RLS
ALTER TABLE public.agent_order_rejections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agents can view their own rejections"
  ON public.agent_order_rejections
  FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM delivery_agents 
      WHERE email = auth.email() AND is_active = true
    )
  );

CREATE POLICY "Agents can insert their own rejections"
  ON public.agent_order_rejections
  FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM delivery_agents 
      WHERE email = auth.email() AND is_active = true
    )
  );

CREATE POLICY "Admins can manage all rejections"
  ON public.agent_order_rejections
  FOR ALL
  USING (is_current_user_admin_v2());

CREATE POLICY "System can create rejections"
  ON public.agent_order_rejections
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.agent_order_rejections IS 'Tracks which agents have rejected/cancelled which orders to prevent showing them the same order again';