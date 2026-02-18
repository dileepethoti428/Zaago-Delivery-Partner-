
# Fix: Profile Photo Not Showing for Delivery Agents

## Root Cause Analysis

Three separate problems are causing profile photos to not appear:

### Problem 1: Profile page never renders the photo
In `src/pages/Profile.tsx`, the `<Avatar>` component only renders `<AvatarFallback>` (initials). `<AvatarImage>` is never included, so even agents who have a photo stored in the database see only initials.

```tsx
// Current — broken
<Avatar className="h-16 w-16">
  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
    {agentProfile?.name ? agentProfile.name.split(' ').map(n => n[0]).join('') : 'DA'}
  </AvatarFallback>
</Avatar>
```

### Problem 2: `delivery_agents.profile_image` not set on signup
In `src/pages/UploadDocuments.tsx`, the profile photo is uploaded to the `agent-photos` storage bucket and its URL is saved in `agent_documents.profile_photo_url`. However, the `delivery_agents` table upsert (lines 131–142) does **not** include the `profile_image` field. So the agent's profile record has no photo URL.

### Problem 3: `fetchAgentProfile` uses only `delivery_agents`
`src/services/agentProfile.ts` only queries `delivery_agents` — so even if the photo exists in `agent_documents`, it is never fetched.

---

## Data State (From DB)

- Agents with `delivery_agents.profile_image` set: Some (those who updated via settings)
- Agents with only `agent_documents.profile_photo_url` set: Most new signups
- Some `agent_documents.profile_photo_url` values are **partial paths** (e.g., `uuid/profile-photo.png`) without the full Supabase URL prefix — these need to be constructed correctly

---

## Fix Plan

### Step 1: Fix `UploadDocuments.tsx` — Save photo URL to `delivery_agents`

When upserting the `delivery_agents` row (lines 131–142), also include `profile_image: profilePhotoUrl` so the photo URL is stored in the main agent table immediately at signup time.

```typescript
const { error: agentError } = await supabase.from('delivery_agents').upsert({
  agent_id: user.id,
  email: user.email,
  name: data.fullName,
  phone: data.phone,
  verification_status: 'pending',
  documents_verified: false,
  is_active: false,
  profile_image: profilePhotoUrl,  // ← ADD THIS
}, { 
  onConflict: 'agent_id',
  ignoreDuplicates: false 
});
```

### Step 2: Fix `fetchAgentProfile` — Also join `agent_documents` for photo fallback

Update `src/services/agentProfile.ts` to also fetch `profile_photo_url` from `agent_documents` as a fallback when `delivery_agents.profile_image` is empty. This fixes existing agents whose `profile_image` column is not populated.

```typescript
export async function fetchAgentProfile(email: string) {
  const { data, error } = await supabase
    .from('delivery_agents')
    .select('*, agent_documents(profile_photo_url)')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  
  if (data) {
    // Use profile_image if set, otherwise fall back to agent_documents photo
    const agentDocs = data.agent_documents as any;
    const fallbackPhoto = agentDocs?.profile_photo_url;
    
    // Build full URL if it's a partial path
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resolvePhotoUrl = (url: string | null | undefined) => {
      if (!url) return null;
      if (url.startsWith('http')) return url;
      // Partial path — construct full URL
      return `${supabaseUrl}/storage/v1/object/public/agent-documents/${url}`;
    };

    return {
      ...data,
      profile_image: resolvePhotoUrl(data.profile_image) || resolvePhotoUrl(fallbackPhoto),
    };
  }
  
  return data;
}
```

### Step 3: Fix `Profile.tsx` — Render `<AvatarImage>` with the photo URL

Update the Avatar in `src/pages/Profile.tsx` to include `<AvatarImage>` so the actual photo is displayed. The `<AvatarFallback>` remains as backup for agents without a photo.

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// In JSX:
<Avatar className="h-16 w-16">
  <AvatarImage 
    src={agentProfile?.profile_image || undefined} 
    alt={agentProfile?.name || 'Agent'} 
  />
  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
    {agentProfile?.name ? agentProfile.name.split(' ').map(n => n[0]).join('') : 'DA'}
  </AvatarFallback>
</Avatar>
```

This way:
- If `profile_image` URL exists → shows the actual photo
- If URL is missing or broken → shows initials fallback automatically (Radix UI `Avatar` handles this natively)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/UploadDocuments.tsx` | Add `profile_image: profilePhotoUrl` to the `delivery_agents` upsert |
| `src/services/agentProfile.ts` | Join `agent_documents` and resolve partial photo URLs |
| `src/pages/Profile.tsx` | Add `<AvatarImage>` to render the actual profile photo |

---

## How It Works After Fix

1. **New agent signs up** → uploads photo → `delivery_agents.profile_image` gets the full public URL immediately
2. **Existing agents** without `profile_image` → `fetchAgentProfile` falls back to `agent_documents.profile_photo_url` and resolves partial paths to full URLs
3. **Profile page** → `<AvatarImage>` renders the photo; falls back to initials if no photo exists
4. **Settings page** (edit profile) → already uses `update-agent-profile` edge function which also sets `profile_image` — no change needed there

No database schema changes required — just reading existing data correctly and saving it in the right place on signup.
