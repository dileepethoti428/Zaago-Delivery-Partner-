import { supabase } from '@/integrations/supabase/client';

export async function fetchAgentProfile(email: string) {
  const { data, error } = await supabase
    .from('delivery_agents')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data;
}
