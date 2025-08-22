-- Add agent settings table for storing preferences
CREATE TABLE IF NOT EXISTS public.agent_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
    personal_info JSONB DEFAULT '{}',
    push_notifications BOOLEAN DEFAULT true,
    sound_alerts BOOLEAN DEFAULT true,
    vibration BOOLEAN DEFAULT false,
    location_services BOOLEAN DEFAULT true,
    vehicle_info JSONB DEFAULT '{}',
    preferred_areas JSONB DEFAULT '[]',
    language TEXT DEFAULT 'English (US)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(agent_id)
);

-- Add agent bank details table for payouts
CREATE TABLE IF NOT EXISTS public.agent_bank_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    account_type TEXT DEFAULT 'savings',
    is_verified BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(agent_id, account_number)
);

-- Add agent wallet table for COD management
CREATE TABLE IF NOT EXISTS public.agent_wallet (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
    balance NUMERIC(10,2) DEFAULT 0.00,
    pending_cod_amount NUMERIC(10,2) DEFAULT 0.00,
    total_collected NUMERIC(10,2) DEFAULT 0.00,
    last_settlement_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(agent_id)
);

-- Add wallet transactions table
CREATE TABLE IF NOT EXISTS public.agent_wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('cod_collected', 'settlement', 'bonus', 'penalty', 'payout')),
    amount NUMERIC(10,2) NOT NULL,
    order_id UUID REFERENCES public.orders(id),
    description TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for all tables
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_settings
CREATE POLICY "Agents can manage own settings" ON public.agent_settings
    FOR ALL USING (agent_id IN (
        SELECT id FROM public.delivery_agents 
        WHERE email = auth.email() AND is_active = true
    ));

CREATE POLICY "Admins can manage all agent settings" ON public.agent_settings
    FOR ALL USING (is_current_user_admin_v2());

-- RLS policies for agent_bank_details
CREATE POLICY "Agents can manage own bank details" ON public.agent_bank_details
    FOR ALL USING (agent_id IN (
        SELECT id FROM public.delivery_agents 
        WHERE email = auth.email() AND is_active = true
    ));

CREATE POLICY "Admins can manage all bank details" ON public.agent_bank_details
    FOR ALL USING (is_current_user_admin_v2());

-- RLS policies for agent_wallet
CREATE POLICY "Agents can view own wallet" ON public.agent_wallet
    FOR SELECT USING (agent_id IN (
        SELECT id FROM public.delivery_agents 
        WHERE email = auth.email() AND is_active = true
    ));

CREATE POLICY "Admins can manage all wallets" ON public.agent_wallet
    FOR ALL USING (is_current_user_admin_v2());

CREATE POLICY "System can update wallet for transactions" ON public.agent_wallet
    FOR UPDATE USING (true);

-- RLS policies for agent_wallet_transactions
CREATE POLICY "Agents can view own transactions" ON public.agent_wallet_transactions
    FOR SELECT USING (agent_id IN (
        SELECT id FROM public.delivery_agents 
        WHERE email = auth.email() AND is_active = true
    ));

CREATE POLICY "Admins can manage all transactions" ON public.agent_wallet_transactions
    FOR ALL USING (is_current_user_admin_v2());

CREATE POLICY "System can create transactions" ON public.agent_wallet_transactions
    FOR INSERT WITH CHECK (true);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agent_settings_updated_at BEFORE UPDATE ON public.agent_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_agent_bank_details_updated_at BEFORE UPDATE ON public.agent_bank_details FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_agent_wallet_updated_at BEFORE UPDATE ON public.agent_wallet FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_agent_wallet_transactions_updated_at BEFORE UPDATE ON public.agent_wallet_transactions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();