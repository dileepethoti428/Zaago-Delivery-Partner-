
# Fix: Deactivated Agent Blocked by `is_active = false` in `delivery_agents` Table

## Root Cause

The admin dashboard deactivates delivery agents by setting `delivery_agents.is_active = false`. However, the agent app's authentication flow only reads from the `profiles` table (checking `approval_status`), which is **never updated** when the admin marks an agent inactive.

```text
Admin Action:          delivery_agents.is_active = false
App Checks:            profiles.approval_status === 'deactivated'  ← never set, never triggered
Result:                Agent logs in successfully, full app access
```

The `profiles.approval_status` column in the real database only ever has: `pending`, `approved`, `rejected` — **never** `'deactivated'`.

---

## Fix Strategy

Check **both** fields — `profiles.approval_status === 'deactivated'` (future-proofing) **AND** `delivery_agents.is_active = false` — at every entry point:

1. **Login time** — block immediately after credentials succeed
2. **Session restore** — block when app opens with existing session
3. **Route guard** — block mid-session if status changes

---

## Changes Required

### 1. Update `src/store/auth.ts` — Fetch `is_active` from `delivery_agents`

Extend the `Profile` interface to include `isActive`:

```typescript
interface Profile {
  // ... existing fields
  isActive?: boolean; // from delivery_agents table
}
```

In `fetchProfile()`, after getting the `profiles` row, do a **second query** to `delivery_agents` to get `is_active` and merge it into the profile state:

```typescript
fetchProfile: async () => {
  const { user } = get();
  if (!user) { set({ profile: null }); return; }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!error && data) {
    // Also check delivery_agents.is_active
    const { data: agentData } = await supabase
      .from('delivery_agents')
      .select('is_active')
      .eq('agent_id', user.id)
      .maybeSingle();

    set({
      profile: {
        ...data as Profile,
        isActive: agentData?.is_active ?? true, // default true if not found yet
      }
    });
  } else {
    set({ profile: null });
  }
},
```

---

### 2. Update `src/pages/Login.tsx` — Block `is_active = false` at Login

In `handleLogin`, after `fetchProfile()`, extend the deactivation check:

```typescript
const currentProfile = useAuthStore.getState().profile;

// Block if approval_status is deactivated OR delivery_agents.is_active is false
if (
  currentProfile?.approval_status === 'deactivated' ||
  currentProfile?.isActive === false
) {
  toast({
    title: "Account Deactivated",
    description: "Your account has been deactivated. Please contact support on WhatsApp.",
    variant: "destructive",
  });
  await supabase.auth.signOut();
  setLoading(false);
  return;
}
```

Also fix the redirect `useEffect` to handle deactivated status:

```typescript
useEffect(() => {
  if (session && profile) {
    if (!profile.documents_submitted) {
      navigate("/upload-documents");
    } else if (profile.approval_status === "pending") {
      navigate("/pending-approval");
    } else if (profile.approval_status === "rejected") {
      navigate("/rejected");
    } else if (profile.approval_status === "deactivated" || profile.isActive === false) {
      navigate("/deactivated");  // ← ADD THIS
    } else if (profile.approval_status === "approved") {
      navigate("/my-deliveries");
    }
  }
}, [session, profile, navigate]);
```

---

### 3. Update `src/components/auth/RequireApproval.tsx` — Block Mid-Session

Add a check for `isActive === false` alongside the existing `deactivated` check:

```typescript
if (profile.approval_status === 'deactivated' || profile.isActive === false) {
  return <Navigate to="/deactivated" replace />;
}
```

This handles the case where an agent is deactivated **while** already using the app — next navigation will redirect them to the deactivated screen.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/store/auth.ts` | Add `isActive` to Profile type + fetch from `delivery_agents` in `fetchProfile()` |
| `src/pages/Login.tsx` | Check `isActive === false` at login + add deactivated redirect in useEffect |
| `src/components/auth/RequireApproval.tsx` | Check `isActive === false` in route guard |

---

## End-to-End Flow After Fix

1. **Admin sets** `delivery_agents.is_active = false`
2. **Agent opens app** → `fetchProfile()` queries both tables → `isActive = false` stored in profile state
3. **At login** → deactivation check triggers → toast shown → sign out → stays on `/login`
4. **Mid-session** → `RequireApproval` detects `isActive === false` → redirects to `/deactivated`
5. **On `/deactivated` page** → WhatsApp contact link + Sign Out button (already built)

No database schema changes needed — only reading the existing `delivery_agents.is_active` column that the admin already controls.
