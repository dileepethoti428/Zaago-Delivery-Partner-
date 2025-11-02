-- Fix auth triggers to prevent conflicts during signup
-- The handle_agent_signin trigger should ONLY run on UPDATE (signin), not INSERT (signup)

DROP TRIGGER IF EXISTS handle_agent_signin_trigger ON auth.users;

CREATE TRIGGER handle_agent_signin_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_agent_signin();

-- Ensure the assign_admin_role_on_signup trigger only fires on INSERT (signup)
DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;

CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_admin_role_on_signup();