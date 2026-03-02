import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupOnLogout } from '@/utils/logoutCleanup';

// Module-level guards — persist across React StrictMode double-mounts
let listenerRegistered = false;
let initialized = false;
let initialSessionReceived = false;

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

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
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
  loading: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) {
      set({ profile: null });
      return;
    }

    const [profileRes, agentRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('delivery_agents').select('is_active').eq('agent_id', user.id).maybeSingle(),
    ]);

    if (!profileRes.error && profileRes.data) {
      set({
        profile: {
          ...(profileRes.data as Profile),
          isActive: agentRes.data?.is_active ?? true,
        }
      });
    } else {
      set({ profile: null });
    }
  },

  initialize: async () => {
    // Idempotent — calling twice is a no-op
    if (initialized) return;
    initialized = true;
    set({ loading: true });

    // Register listener FIRST (before getSession) — Supabase docs requirement.
    // INITIAL_SESSION fires synchronously from localStorage on most app opens.
    if (!listenerRegistered) {
      listenerRegistered = true;

      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);

        if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, profile: null });
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          // Silently update session — no profile fetch needed
          set({ session, user: session?.user ?? null });
          return;
        }

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
        if (event === 'INITIAL_SESSION') {
          initialSessionReceived = true;
        }

        set({ session, user: session?.user ?? null });

        if (session?.user) {
          // Skip fetchProfile if we already have a profile for this user
          if (get().profile?.user_id !== session.user.id) {
            get().fetchProfile().catch(console.warn);
          }
        } else {
          set({ profile: null });
        }

        // INITIAL_SESSION: mark loading done after profile is ready
        // This is the primary path for session restoration on app open
        if (event === 'INITIAL_SESSION') {
          set({ loading: false });
        }
      });
    }

    try {
      // Race getSession vs 5s timeout.
      // On most app opens getSession reads from localStorage instantly.
      // On expired tokens it must make a network call to refresh.
      const result = await Promise.race([
        supabase.auth.getSession().then(r => ({
          timedOut: false as const,
          session: r.data.session ?? null,
        })),
        new Promise<{ timedOut: true; session: null }>(resolve =>
          setTimeout(() => resolve({ timedOut: true, session: null }), 5000)
        ),
      ]);

      if (!result.timedOut) {
        // getSession returned — if INITIAL_SESSION already fired, do nothing
        if (!initialSessionReceived) {
          const session = result.session;
          set({ session, user: session?.user ?? null });
          if (session?.user) {
            await Promise.race([
              get().fetchProfile(),
              new Promise<void>(r => setTimeout(r, 4000)),
            ]);
          }
          set({ loading: false });
        }
        // else: INITIAL_SESSION handler already set loading: false — nothing to do
      } else {
        // Timeout — if INITIAL_SESSION never arrived, auth is stuck: go to login
        if (!initialSessionReceived) {
          console.warn('[Auth] getSession timed out — continuing with existing session');
          set({ loading: false });
        }
        // else: INITIAL_SESSION handler is in flight or done — don't interfere
      }
    } catch (err) {
      console.warn('[Auth] Initialize error, clearing session:', err);
      set({ session: null, user: null, profile: null });
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      if (!initialSessionReceived) {
        set({ loading: false });
      }
    }
  },

  signOut: async () => {
    // Reset module flags so the next login cycle re-initializes cleanly
    initialized = false;
    initialSessionReceived = false;
    // listenerRegistered stays true — listener persists across sign-out/sign-in

    await cleanupOnLogout();
    set({ session: null, user: null, profile: null, loading: false });
  },
}));
