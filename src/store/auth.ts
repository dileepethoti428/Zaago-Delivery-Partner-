import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupOnLogout } from '@/utils/logoutCleanup';

// Module-level guards — persist across React StrictMode double-mounts
let listenerRegistered = false;
let initialized = false;

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  emergency_contact: string | null;
  approval_status: 'pending' | 'approved' | 'rejected' | 'deactivated';
  documents_submitted: boolean;
  submission_date: string | null;
  rejection_reason: string | null;
  isActive?: boolean; // from delivery_agents.is_active
}

export type ProfileState = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileState: ProfileState;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  fetchProfile: () => Promise<void>;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  profileState: 'idle',
  loading: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile, profileState: profile ? 'ready' : 'missing' }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) {
      set({ profile: null, profileState: 'missing' });
      return;
    }

    set({ profileState: 'loading' });

    try {
      const [profileRes, agentRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('delivery_agents').select('is_active').eq('agent_id', user.id).maybeSingle(),
      ]);

      if (!profileRes.error && profileRes.data) {
        set({
          profile: {
            ...(profileRes.data as Profile),
            isActive: agentRes.data?.is_active ?? true,
          },
          profileState: 'ready',
        });
      } else if (profileRes.error) {
        // Distinguish "no row" (PGRST116) from real errors (network/RLS/5xx)
        const isNoRow = profileRes.error.code === 'PGRST116';
        if (isNoRow) {
          console.warn('[Auth] Profile not found (no row)');
          set({ profile: null, profileState: 'missing' });
        } else {
          console.warn('[Auth] Profile fetch API error:', profileRes.error.message, profileRes.error.code);
          set({ profileState: 'error' });
          throw new Error(profileRes.error.message);
        }
      } else {
        // No error but no data — treat as missing
        set({ profile: null, profileState: 'missing' });
      }
    } catch (err) {
      console.warn('[Auth] Profile fetch network error:', err);
      set({ profileState: 'error' });
      throw err; // re-throw so callers can catch
    }
  },

  initialize: async () => {
    // Idempotent — calling twice is a no-op
    if (initialized) return;
    initialized = true;

    // loading stays TRUE until INITIAL_SESSION fires — never set it early
    set({ loading: true, profileState: 'idle' });

    // Register listener FIRST (before getSession) — Supabase requirement.
    // INITIAL_SESSION is the ONLY event that clears loading state.
    if (!listenerRegistered) {
      listenerRegistered = true;

      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);

        if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          // Silently update session — only if token actually changed
          const current = get().session;
          if (current?.access_token !== session?.access_token) {
            set({ session, user: session?.user ?? null });
          }
          return;
        }

        // Only update state if session actually changed (prevents LocationSync restarts)
        const currentSession = get().session;
        if (currentSession?.access_token !== session?.access_token) {
          set({ session, user: session?.user ?? null });
        }

        // INITIAL_SESSION is the authoritative signal that auth is resolved.
        // loading must remain true until this fires — no manual overrides.
        if (event === 'INITIAL_SESSION') {
          set({ loading: false });
        }

        if (session?.user) {
          // Skip fetchProfile if we already have a profile for this user
          if (get().profile?.user_id !== session.user.id) {
            // Fire-and-forget profile fetch with retries — never block UI
            const scheduleRetry = (attempt: number) => {
              const retryDelays = [2000, 4000, 8000];
              if (attempt >= retryDelays.length) return;
              setTimeout(() => {
                if (get().profileState !== 'ready') {
                  console.log(`[Auth] Retrying profile fetch (attempt ${attempt + 1})...`);
                  get().fetchProfile().catch(() => scheduleRetry(attempt + 1));
                }
              }, retryDelays[attempt]);
            };

            get().fetchProfile().catch((err: any) => {
              console.warn('[Auth] Profile fetch issue:', err?.message);
              if (get().profileState === 'loading') {
                set({ profileState: 'error' });
              }
              scheduleRetry(0);
            });
          }
        } else {
          set({ profile: null, profileState: 'missing' });
        }
      });
    }

    // Call getSession to trigger the INITIAL_SESSION event from the listener above.
    // No timeout race — we trust Supabase to fire INITIAL_SESSION from localStorage synchronously.
    try {
      await supabase.auth.getSession();
    } catch (err) {
      // Network failure on getSession — INITIAL_SESSION may not fire.
      // Clear loading so the app doesn't hang indefinitely.
      console.warn('[Auth] getSession failed:', err);
      if (!get().session) {
        set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
      } else {
        // Preserve existing session (from a previous event), just unblock UI
        set({ loading: false });
      }
    }
  },

  signOut: async () => {
    // Reset module flags so the next login cycle re-initializes cleanly
    initialized = false;
    // listenerRegistered stays true — listener persists across sign-out/sign-in

    await cleanupOnLogout();
    set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
  },
}));
