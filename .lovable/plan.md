
## What's Actually Happening

The console shows `TOKEN_REFRESHED` fires first — but the current auth store has an **early return** for `TOKEN_REFRESHED` that only updates the session token if it changed, and **does not set the user**. This means `user` in the store remains `null` briefly, so `user?.email` is `undefined`, and `useProfile(user?.email)` is disabled (`enabled: !!email` → false). When `SIGNED_IN` fires later and sets the user, `useProfile` finally becomes enabled and fires — but there's a gap where the UI renders with `profileLoading: true` and never gets a resolution if the query somehow doesn't re-enable.

**The core problem:** Two separate profile systems are fighting each other:
1. `useAuthStore.profile` — fetched inside the auth store listener
2. `useProfile(user?.email)` — a React Query in `Home.tsx` that fetches from `delivery_agents` by email

`Home.tsx` blocks on `useProfile` (the React Query one), not on `useAuthStore.profileState`. The auth store's profile fetch being correct doesn't help Home at all.

**Secondary issue:** `TOKEN_REFRESHED` skips setting `user`, so on a cold refresh where `TOKEN_REFRESHED` fires before `INITIAL_SESSION`, `user` is briefly null → `useProfile` never fires initially.

## The Fix (Two surgical changes)

### 1. Fix `TOKEN_REFRESHED` in `src/store/auth.ts`
The early return for `TOKEN_REFRESHED` must **always sync session AND user**, not just when the token changed. The token-diff guard was causing `user` to stay `null` if it was the first event:

```ts
if (event === 'TOKEN_REFRESHED') {
  // Always sync session+user — user may be null if this is the first event
  set({ session, user: session?.user ?? null });
  return;
}
```

### 2. Fix profile fetch guard in `src/store/auth.ts`
The current guard `if (get().profile?.user_id !== session.user.id)` prevents re-fetching if a profile already exists for the same user. But on refresh, the profile is `null` (store resets), yet `profileState` might be `idle` or `loading` — so the fetch might still be guarded incorrectly. Replace with the cleaner `profileState !== 'ready'` guard as prescribed:

```ts
if (session?.user && get().profileState !== 'ready') {
  get().fetchProfile().catch(() => {});
}
```

This ensures that whenever any auth event brings a session, profile is fetched if not already ready — regardless of whether `profile` object is populated or not.

### Files to change
- **`src/store/auth.ts`** only — two targeted edits:
  1. `TOKEN_REFRESHED` handler: always set `{ session, user }`, remove the access_token diff guard
  2. Profile fetch condition: replace `profile?.user_id !== session.user.id` with `profileState !== 'ready'`

### Expected boot sequence after fix
```
Boot → listener registered
  TOKEN_REFRESHED fires → session+user synced ✅
  OR
  INITIAL_SESSION fires → loading=false, session+user synced ✅
  SIGNED_IN fires → loading=false ✅
  
profileState !== 'ready' → fetchProfile() called ✅
profileState → 'ready' ✅
useProfile(user?.email) enabled → agent data loaded ✅
Home renders ✅
```

No changes needed to `Home.tsx`, `useProfile`, or any other file.
