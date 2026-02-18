
# Fix: Profile Photo Not Showing in Settings / Edit Profile

## Root Cause

The Settings page already has `<AvatarImage>` rendering correctly at line 224:

```tsx
<Avatar className="h-24 w-24">
  <AvatarImage src={profileForm.watch('profile_image_url')} />
  <AvatarFallback ...>
```

The form value `profile_image_url` is populated from:
```typescript
profile_image_url: settings?.profile?.profile_image || '',
```

And `settings.profile` comes from the `get-agent-settings` edge function, which fetches `delivery_agents` but **stops there** — it never falls back to `agent_documents.profile_photo_url` if `delivery_agents.profile_image` is NULL.

This is the exact same bug that was fixed in `fetchAgentProfile` for the Profile page. The Settings page uses a different data path (an edge function) and needs the same fix applied there.

## Data Flow Comparison

```
Profile page:
  fetchAgentProfile() → delivery_agents + agent_documents fallback ✓ FIXED

Settings page (Edit Profile):
  get-agent-settings edge function → delivery_agents only ✗ MISSING FALLBACK
```

## Fix — One File Change

### `supabase/functions/get-agent-settings/index.ts`

After fetching the agent row (line 43–55), add a second query to `agent_documents` using `user_id = user.id` to get `profile_photo_url`, then resolve and merge it into the `agent.profile_image` field before building the response.

The `resolvePhotoUrl` helper logic (same as in `agentProfile.ts`) needs to be replicated in the edge function (Deno):

```typescript
function resolvePhotoUrl(url: string | null | undefined, supabaseUrl: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${supabaseUrl}/storage/v1/object/public/agent-documents/${url}`;
}
```

Then after fetching `agent`, before building the `response`:

```typescript
// Fetch profile photo fallback from agent_documents
const { data: photoDoc } = await serviceClient
  .from('agent_documents')
  .select('profile_photo_url')
  .eq('user_id', user.id)
  .maybeSingle();

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const resolvedPhoto =
  resolvePhotoUrl(agent.profile_image, supabaseUrl) ||
  resolvePhotoUrl(photoDoc?.profile_photo_url, supabaseUrl);

// Merge resolved photo back into agent object
agent = { ...agent, profile_image: resolvedPhoto };
```

This means `settings.profile.profile_image` will now contain a fully resolved URL for all agents — exactly what `profileForm.watch('profile_image_url')` needs to display the avatar in the Settings edit profile section.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/get-agent-settings/index.ts` | Add `resolvePhotoUrl` helper + separate `agent_documents` query + merge resolved photo into agent before response |

No frontend changes needed — the Settings page Avatar is already wired up correctly, it just needs the data to arrive populated.

## Result After Fix

- All agents whose photo is stored only in `agent_documents.profile_photo_url` will now see it in the Settings edit profile avatar
- Full URL photos pass through unchanged (`startsWith('http')` check)
- Partial path photos get resolved to the correct public storage URL
- Agents with no photo at all see the initials fallback (unchanged behaviour)
