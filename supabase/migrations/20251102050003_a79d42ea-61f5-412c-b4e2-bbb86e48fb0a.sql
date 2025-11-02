-- Create agent_documents table for storing document metadata
CREATE TABLE IF NOT EXISTS public.agent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  
  -- Aadhar Card
  aadhar_number TEXT,
  aadhar_front_url TEXT,
  aadhar_back_url TEXT,
  aadhar_verified BOOLEAN DEFAULT false,
  
  -- Driving License
  dl_number TEXT,
  dl_front_url TEXT,
  dl_back_url TEXT,
  dl_expiry_date DATE,
  dl_verified BOOLEAN DEFAULT false,
  
  -- Additional Documents
  profile_photo_url TEXT,
  
  -- Verification Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  verification_notes TEXT,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Add document fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS documents_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS documents_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS submission_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add verification fields to delivery_agents table
ALTER TABLE public.delivery_agents
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS documents_verified BOOLEAN DEFAULT false;

-- Create storage bucket for agent documents (PRIVATE)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-documents', 
  'agent-documents', 
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on agent_documents table
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_documents table
CREATE POLICY "Users can view their own documents"
ON public.agent_documents
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own documents"
ON public.agent_documents
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own documents"
ON public.agent_documents
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all documents"
ON public.agent_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update all documents"
ON public.agent_documents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Storage RLS Policies for agent-documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agent-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all agent documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Update the signup trigger to set approval_status to pending
CREATE OR REPLACE FUNCTION public.assign_admin_role_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create profile with PENDING status (require admin approval)
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    approval_status,
    documents_submitted,
    documents_verified
  )
  VALUES (
    NEW.id, 
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'name', 
      split_part(NEW.email, '@', 1)
    ),
    'pending',
    false,
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Assign 'user' role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at on agent_documents
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_documents_updated_at
  BEFORE UPDATE ON public.agent_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();