-- Create a function to approve/reject agents directly
CREATE OR REPLACE FUNCTION approve_agent_direct(
  p_user_id UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_result JSON;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update profiles table
  UPDATE profiles
  SET 
    approval_status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    approved_by = CASE WHEN p_approved THEN p_admin_id ELSE NULL END,
    approved_at = CASE WHEN p_approved THEN NOW() ELSE NULL END,
    rejection_reason = CASE WHEN p_approved THEN NULL ELSE p_rejection_reason END,
    documents_verified = CASE WHEN p_approved THEN TRUE ELSE FALSE END
  WHERE user_id = p_user_id;

  -- Update delivery_agents table
  IF p_approved THEN
    UPDATE delivery_agents
    SET 
      verification_status = 'approved',
      documents_verified = TRUE,
      is_active = TRUE
    WHERE email = v_user_email;

    -- Update agent_documents table
    UPDATE agent_documents
    SET 
      aadhar_verified = TRUE,
      dl_verified = TRUE,
      verified_at = NOW(),
      verified_by = p_admin_id
    WHERE user_id = p_user_id;
  ELSE
    UPDATE delivery_agents
    SET 
      verification_status = 'rejected',
      is_active = FALSE
    WHERE email = v_user_email;
  END IF;

  v_result := json_build_object(
    'success', true,
    'message', CASE WHEN p_approved THEN 'Agent approved successfully' ELSE 'Agent rejected' END
  );

  RETURN v_result;
END;
$$;

-- Grant admin access to current user (Solution 3)
-- Replace with actual user ID: 81594858-e50b-43f9-9e28-d04d2fa79708
INSERT INTO user_roles (user_id, role) 
VALUES ('81594858-e50b-43f9-9e28-d04d2fa79708', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;