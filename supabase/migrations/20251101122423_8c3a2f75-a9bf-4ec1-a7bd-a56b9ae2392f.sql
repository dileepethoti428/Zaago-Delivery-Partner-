-- Phase 1: Add accepted_at to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;

-- Create agent_earnings_tracking table
CREATE TABLE IF NOT EXISTS agent_earnings_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES delivery_agents(id),
  order_id uuid NOT NULL REFERENCES orders(id),
  
  -- Timing
  accepted_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  
  -- Payout calculation
  expected_payout numeric NOT NULL DEFAULT 0,
  actual_payout numeric,
  payout_status text NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled'
  
  -- Metadata
  distance_km numeric DEFAULT 0,
  payment_method text,
  is_peak_hour boolean DEFAULT false,
  payout_breakdown jsonb, -- {base_pay, distance_pay, peak_bonus}
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT unique_order_tracking UNIQUE(order_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_agent_earnings_agent_accepted ON agent_earnings_tracking(agent_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_earnings_status ON agent_earnings_tracking(payout_status);
CREATE INDEX IF NOT EXISTS idx_agent_earnings_accepted_date ON agent_earnings_tracking(accepted_at);

-- Enable RLS
ALTER TABLE agent_earnings_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agents can view own earnings tracking"
ON agent_earnings_tracking FOR SELECT
USING (
  agent_id IN (
    SELECT id FROM delivery_agents 
    WHERE email = auth.email() AND is_active = true
  )
);

CREATE POLICY "System can manage earnings tracking"
ON agent_earnings_tracking FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');