
# Fix: Profile Photos Not Loading for Most Delivery Agents

## Root Cause Found

After querying the database directly, two distinct bugs were identified:

### Bug 1: The Supabase join is silently broken for almost all agents

In `src/services/agentProfile.ts`, the code uses:
```typescript
.select('*, agent_documents(profile_photo_url)')
```

This tells Supabase PostgREST to JOIN `delivery_agents` to `agent_documents` using the existing foreign key relationship. The `agent_documents` table has a column `agent_id` which is a FK to `delivery_agents.id` (the integer primary key), NOT to `delivery_agents.agent_id` (the UUID).

For almost every agent in the database, `agent_documents.agent_id` is NULL — so the join returns nothing, and `agent_documents` comes back as `null`. Only `mani@gmail.com` happens to work because their `delivery_agents.profile_image` column is already populated.

**Database proof:**
- `agent_documents.agent_id` is FK → `delivery_agents.id` (integer PK)
- But agents' user UUIDs are stored in `agent_documents.user_id`
- The join `agent_documents(profile_photo_url)` matches zero rows for agents where `agent_documents.agent_id` is NULL

### Bug 2: Wrong storage bucket in `resolvePhotoUrl`

When partial paths exist (e.g. `517990b0.../profile-photo.png`), the `resolvePhotoUrl` function constructs URLs pointing to the `agent-documents` bucket:
```
/storage/v1/object/public/agent-documents/{path}
```
But the actual photos for most agents are in the `agent-photos` bucket. This means even if the path is found, the resolved URL points to the wrong bucket.

---

## What the Data Actually Looks Like

From the database:

| Agent | `delivery_agents.profile_image` | `agent_documents.profile_photo_url` |
|-------|------|------|
| mani@gmail.com | Full URL (agent-documents bucket) | Full URL (agent-photos bucket) |
| sesh673@gmail.com | NULL | Full URL (agent-photos bucket) |
| nani@gmail.com | NULL | Full URL (agent-photos bucket) |
| man@gmail.com | NULL | Full URL (agent-photos bucket) |
| sesh2@gmail.com | Full URL (agent-documents) | Partial path (wrong bucket in resolver) |

Most agents have their photo ONLY in `agent_documents.profile_photo_url`, as a full URL pointing to the `agent-photos` bucket. The current join never fetches this.

---

## Fix Plan

### Step 1: Fix `src/services/agentProfile.ts` — Use a separate query instead of a broken join

Replace the broken join with a two-step fetch:
1. Fetch the agent from `delivery_agents` by email
2. Separately fetch `agent_documents` using `user_id = agent.agent_id` (UUID match)

```typescript
export async function fetchAgentProfile(email: string) {
  // Step 1: Fetch agent record
  const { data, error } = await supabase
    .from('delivery_agents')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  if (!data) return data;

  // Step 2: Separately fetch agent_documents using user_id = agent_id (UUID)
  const { data: docData } = await supabase
    .from('agent_documents')
    .select('profile_photo_url')
    .eq('user_id', data.agent_id)
    .maybeSingle();

  const fallbackPhoto = docData?.profile_photo_url ?? null;

  return {
    ...data,
    profile_image: resolvePhotoUrl(data.profile_image) || resolvePhotoUrl(fallbackPhoto),
  };
}
```

### Step 2: Fix `resolvePhotoUrl` — Handle both buckets

The current resolver always uses `agent-documents` bucket for partial paths. But partial paths like `517990b0.../profile-photo.png` are actually in `agent-documents` (uploaded via the old flow), while full URLs already contain the correct bucket name. Since full URLs already start with `http` and get returned as-is, and partial paths are only from the old `agent-documents` upload flow, the bucket for partial paths is correct (`agent-documents`). However we must also verify that the full URL from `agent-photos` (the newer flow) passes through correctly — which it does since `url.startsWith('http')` returns it as-is.

No change needed to `resolvePhotoUrl` — it handles both cases correctly once the separate query returns the right data.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/services/agentProfile.ts` | Replace broken Supabase join with a separate `agent_documents` query using `user_id = agent.agent_id` |

That is the only change needed. The Profile UI (`Profile.tsx`) already has `<AvatarImage>` correctly implemented, and `UploadDocuments.tsx` already saves `profile_image`. The single root cause is the silently failing join.

---

## End-to-End After Fix

1. Agent logs in → `useProfile(email)` calls `fetchAgentProfile(email)`
2. Step 1 fetches `delivery_agents` row by email → gets `agent_id` (UUID) and `profile_image`
3. Step 2 fetches `agent_documents` row where `user_id = agent_id` → gets `profile_photo_url`
4. `profile_image` = first non-null of: `delivery_agents.profile_image`, `agent_documents.profile_photo_url`
5. `<AvatarImage src={agentProfile.profile_image}>` renders the photo
6. If no photo exists anywhere → `<AvatarFallback>` shows initials
