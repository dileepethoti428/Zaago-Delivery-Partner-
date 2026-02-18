import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  // Partial path — construct full public URL
  return `${SUPABASE_URL}/storage/v1/object/public/agent-documents/${url}`;
}

export async function fetchAgentProfile(email: string) {
  // Step 1: Fetch agent record by email
  const { data, error } = await supabase
    .from('delivery_agents')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  if (!data) return data;

  // Step 2: Separately fetch agent_documents using user_id = agent_id (UUID match)
  // The broken join used agent_documents.agent_id (integer FK, NULL for most agents)
  // The correct field is agent_documents.user_id which stores the auth UUID
  const { data: docData } = await supabase
    .from('agent_documents')
    .select('profile_photo_url')
    .eq('user_id', data.agent_id)
    .maybeSingle();

  const fallbackPhoto = docData?.profile_photo_url ?? null;

  return {
    ...data,
    profile_image:
      resolvePhotoUrl(data.profile_image) || resolvePhotoUrl(fallbackPhoto),
  };
}
