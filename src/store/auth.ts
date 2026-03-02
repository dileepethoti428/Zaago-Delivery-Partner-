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
        set({ profile: null, profileState: 'missing' });
      }
    } catch (err) {
      console.warn('[Auth] Profile fetch network error:', err);
      set({ profileState: 'error' });
      throw err;
    }
  },

  initialize: async () => {
    // Idempotent — calling twice is a no-op
    if (initialized) return;
    initialized = true;

    // loading stays TRUE until INITIAL_SESSION or SIGNED_IN fires
    set({ loading: true, profileState: 'idle' });

    if (!listenerRegistered) {
      listenerRegistered = true;

      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);

        // TOKEN_REFRESHED: always sync session+user so downstream queries (e.g. useProfile) can fire
        if (event === 'TOKEN_REFRESHED') {
          set({ session, user: session?.user ?? null, loading: false });
          return;
        }

        if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
          return;
        }

        // Always sync session unconditionally for all other events
        set({ session, user: session?.user ?? null });

        // INITIAL_SESSION and SIGNED_IN are the authoritative signals that auth is resolved
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          set({ loading: false });
        }

        if (session?.user) {
          // Fetch profile whenever session exists and profile isn't already ready
          if (get().profileState !== 'ready') {
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

    // No manual getSession() call — Supabase fires INITIAL_SESSION automatically
    // when onAuthStateChange listener is registered, reading from localStorage.

    // Safety fallback — if no auth event fires within 4s, unlock UI
    setTimeout(() => {
      if (get().loading) {
        console.warn('[Auth] Safety unlock triggered — no auth event received');
        set({ loading: false });
      }
    }, 4000);
  },

  signOut: async () => {
    // Reset module flags so the next login cycle re-initializes cleanly
    initialized = false;
    // listenerRegistered stays true — listener persists across sign-out/sign-in

    await cleanupOnLogout();
    set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
  },
}));
