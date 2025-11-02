-- Fix Critical Security Issues: Sellers Table RLS Policies

-- Drop overly permissive policies that expose bank details
DROP POLICY IF EXISTS "Anyone can view active sellers" ON public.sellers;
DROP POLICY IF EXISTS "Sellers can view all sellers" ON public.sellers;

-- Keep only the secure policies:
-- 1. "Sellers can view their own profile" - already exists (user_id = auth.uid())
-- 2. Admin policies - already exist and are secure

-- Note: The following secure policies should remain:
-- - "Sellers can view their own profile" (user_id = auth.uid())
-- - "Admins can view all sellers" (is_current_user_admin_v2())
-- - "Admins can update sellers" (is_current_user_admin_v2())
-- - "Sellers can update their own profile" (user_id = auth.uid())

-- For public seller listings, create a restricted view with limited columns (no bank details)
CREATE OR REPLACE VIEW public.public_sellers AS
SELECT 
  id,
  name,
  business_name,
  status,
  created_at
FROM public.sellers
WHERE status = 'active';

-- Grant public access to the view only
GRANT SELECT ON public.public_sellers TO anon;
GRANT SELECT ON public.public_sellers TO authenticated;

COMMENT ON VIEW public.public_sellers IS 'Public-facing seller listing without sensitive financial data';
