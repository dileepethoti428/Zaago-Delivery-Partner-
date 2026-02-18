import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function resolvePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  // Partial path — construct full public URL
  return `${SUPABASE_URL}/storage/v1/object/public/agent-documents/${url}`;
}

export async function fetchAgentProfile(email: string) {
  const { data, error } = await supabase
    .from('delivery_agents')
    .select('*, agent_documents(profile_photo_url)')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const agentDocs = data.agent_documents as { profile_photo_url?: string | null } | null;
    const fallbackPhoto = agentDocs?.profile_photo_url ?? null;

    return {
      ...data,
      profile_image:
        resolvePhotoUrl(data.profile_image) || resolvePhotoUrl(fallbackPhoto),
    };
  }

  return data;
}
