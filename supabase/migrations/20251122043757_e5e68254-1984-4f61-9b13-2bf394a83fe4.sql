-- Add missing columns to delivery_agents table
ALTER TABLE delivery_agents 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS vehicle_number TEXT;

-- Add missing columns to agent_settings table
ALTER TABLE agent_settings
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_accept_orders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_new_orders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_earnings_updates BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_promotions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;

-- Add UPI to agent_bank_details table
ALTER TABLE agent_bank_details
ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Add KYC status to agent_documents table
ALTER TABLE agent_documents
ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_review', 'approved', 'rejected'));

-- Update RLS policies for agent_settings
DROP POLICY IF EXISTS "Agents can view their own settings" ON agent_settings;
DROP POLICY IF EXISTS "Agents can update their own settings" ON agent_settings;
DROP POLICY IF EXISTS "Agents can insert their own settings" ON agent_settings;

CREATE POLICY "Agents can view their own settings" 
ON agent_settings FOR SELECT 
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own settings" 
ON agent_settings FOR UPDATE 
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own settings" 
ON agent_settings FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

-- Update RLS policies for agent_bank_details
DROP POLICY IF EXISTS "Agents can view their own bank details" ON agent_bank_details;
DROP POLICY IF EXISTS "Agents can update their own bank details" ON agent_bank_details;
DROP POLICY IF EXISTS "Agents can insert their own bank details" ON agent_bank_details;

CREATE POLICY "Agents can view their own bank details" 
ON agent_bank_details FOR SELECT 
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own bank details" 
ON agent_bank_details FOR UPDATE 
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own bank details" 
ON agent_bank_details FOR INSERT 
WITH CHECK (auth.uid() = agent_id);

-- Update RLS policies for agent_documents
DROP POLICY IF EXISTS "Agents can view their own documents" ON agent_documents;
DROP POLICY IF EXISTS "Agents can update their own documents" ON agent_documents;

CREATE POLICY "Agents can view their own documents" 
ON agent_documents FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Agents can update their own documents" 
ON agent_documents FOR UPDATE 
USING (auth.uid() = user_id);