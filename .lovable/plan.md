
# Fix: Deactivated Agent Account Blocking

## Root Cause

The delivery agent app's `RequireApproval.tsx` only handles three `approval_status` values: `pending`, `approved`, and `rejected`. When an admin deactivates an already-approved agent by setting `approval_status = 'deactivated'` (or a similar status), it falls through the guard and the agent retains full access to the app.

There is currently:
- No `deactivated` route or page
- No check in `RequireApproval.tsx` for deactivated status
- No session restore guard (so a deactivated agent returning with a valid session also gets in)
- No login-time check

---

## Implementation Plan

### Step 1: Create the Deactivated Page

**Create:** `src/pages/Deactivated.tsx`

A full-screen page matching the seller app's design (image reference), adapted for delivery agents:

- Dark-themed card with a ShieldOff icon (red, on dark background)
- Title: **"Account Deactivated"**
- Description: "Your delivery agent account has been deactivated by the administrator. You cannot access the app until your account is reactivated."
- WhatsApp contact link: `https://wa.me/917842343642` (matching the existing WhatsApp support number used throughout the app)
- Sign Out button (calls `signOut()` and redirects to `/login`)

The design will follow the existing app styling (`bg-gradient-to-br from-primary/10 via-background to-primary/5`, `Card` with `rounded-2xl shadow-xl border-0 bg-card/50 backdrop-blur`) while visually communicating deactivation severity.

---

### Step 2: Add Route

**Update:** `src/router/index.tsx`

Add `/deactivated` as a protected route under `RequireAuth` (agent must be logged in to see this page):

```
RequireAuth
  ├── /upload-documents
  ├── /pending-approval
  ├── /rejected
  ├── /deactivated      ← NEW
  └── RequireApproval
      └── ...app routes
```

---

### Step 3: Update RequireApproval Guard

**Update:** `src/components/auth/RequireApproval.tsx`

Add a deactivated check before the existing approval_status checks:

```typescript
// Check if account is deactivated (after rejection check)
if (profile.approval_status === 'deactivated') {
  return <Navigate to="/deactivated" replace />;
}
```

This blocks access to all protected app routes when status is `deactivated`.

---

### Step 4: Block at Login Time

**Update:** `src/pages/Login.tsx`

After `fetchProfile()` resolves in `handleLogin`, check if the profile is deactivated before navigation proceeds:

```typescript
await fetchProfile();

// Check deactivated status immediately after fetching profile
const currentProfile = useAuthStore.getState().profile;
if (currentProfile?.approval_status === 'deactivated') {
  toast({
    title: "Account Deactivated",
    description: "Your account has been deactivated. Please contact support.",
    variant: "destructive",
  });
  await supabase.auth.signOut(); // Sign them out
  setLoading(false);
  return; // Stop, don't navigate
}
```

This prevents deactivated agents from even entering the app at login.

---

### Step 5: Block on Session Restore

**Update:** `src/store/auth.ts`

In the `fetchProfile` function, after fetching the profile, check if it's deactivated and sign out if so. This handles the case where an agent is deactivated **while** actively using the app or returns with an existing session:

```typescript
fetchProfile: async () => {
  // ... existing fetch logic ...

  if (!error && data) {
    const profile = data as Profile;
    
    // If agent was deactivated while using the app, force sign out
    if (profile.approval_status === 'deactivated') {
      console.warn('[Auth] Agent account is deactivated, signing out');
      await cleanupOnLogout();
      set({ session: null, user: null, profile: null, loading: false });
      // Navigation handled by RequireApproval
      return;
    }
    
    set({ profile });
  }
}
```

Actually, a cleaner approach: just set the profile normally and let `RequireApproval` redirect them. The `initialize()` function's `onAuthStateChange` already calls `fetchProfile()` on every session event, so the guard will catch it. Only the Login page needs the explicit block.

---

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `src/pages/Deactivated.tsx` | Deactivated account screen with WhatsApp contact + Sign Out |
| **Update** | `src/router/index.tsx` | Add `/deactivated` route |
| **Update** | `src/components/auth/RequireApproval.tsx` | Block deactivated agents from app routes |
| **Update** | `src/pages/Login.tsx` | Block deactivated agents at login |

---

## Profile Type Update

**Update:** `src/store/auth.ts`

The `Profile` interface's `approval_status` union type needs to include `'deactivated'`:

```typescript
approval_status: 'pending' | 'approved' | 'rejected' | 'deactivated';
```

---

## How It Works End-to-End

1. **Admin deactivates agent** → sets `profiles.approval_status = 'deactivated'`
2. **Agent tries to login** → `handleLogin` fetches profile → sees `deactivated` → signs out + shows error toast → stays on login
3. **Agent has existing session and opens app** → `initialize()` → `fetchProfile()` → `RequireApproval` reads profile → redirects to `/deactivated`
4. **Agent gets deactivated mid-session** → next route navigation → `RequireApproval` checks profile → redirects to `/deactivated`
5. **Agent on `/deactivated` page** → sees "Account Deactivated" UI with WhatsApp contact link → taps Sign Out → goes to `/login`

---

## Design Reference (from screenshot)

The deactivated page will mirror the seller app screenshot:
- Full dark-background screen
- Circular icon container with red ShieldOff icon
- Bold title "Account Deactivated"
- Subtext explaining admin deactivation and inability to access until reactivated
- Green WhatsApp contact link with icon
- Sign Out button (full width)
