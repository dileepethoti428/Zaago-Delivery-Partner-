import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupOnLogout } from '@/utils/logoutCleanup';

// Module-level guard: ensures onAuthStateChange is registered only once
// across React StrictMode double-mounts and hot reloads
let listenerRegistered = false;

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

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      // Also check delivery_agents.is_active (admin deactivation via dashboard)
      const { data: agentData } = await supabase
        .from('delivery_agents')
        .select('is_active')
        .eq('agent_id', user.id)
        .maybeSingle();

      set({
        profile: {
          ...(data as Profile),
          isActive: agentData?.is_active ?? true, // default true if agent row not yet created
        }
      });
    } else {
      set({ profile: null });
    }
  },

  initialize: async () => {
    set({ loading: true });

    // Register listener FIRST (before getSession) — required by Supabase docs to catch INITIAL_SESSION.
    // Guard prevents duplicate listeners from React StrictMode double-mounts.
    if (!listenerRegistered) {
      listenerRegistered = true;
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);

        if (event === 'SIGNED_OUT') {
          // Only clear state on explicit sign-out — never on resume or token refresh
          set({ session: null, user: null, profile: null });
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          // Silently update session object — no profile fetch needed
          set({ session, user: session?.user ?? null });
          return;
        }

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
        set({ session, user: session?.user ?? null });

        if (session?.user) {
          // Skip fetchProfile if we already have a profile for this user (e.g. Login.tsx fetched it directly)
          // This prevents a double-fetch race when SIGNED_IN fires concurrently with handleLogin
          if (get().profile?.user_id !== session.user.id) {
            await get().fetchProfile();
          }
        } else {
          set({ profile: null });
        }
      });
    }

    try {
      // Race getSession against a 5s timeout to prevent indefinite hang.
      // IMPORTANT: if the timeout wins, do NOT overwrite session state with null —
      // the onAuthStateChange INITIAL_SESSION event will have already set the real session.
      let timedOut = false;
      const sessionResult = await Promise.race([
        supabase.auth.getSession().then(r => ({ timedOut: false, result: r })),
        new Promise<{ timedOut: true; result: null }>(resolve =>
          setTimeout(() => resolve({ timedOut: true, result: null }), 5000)
        ),
      ]);

      if (!sessionResult.timedOut) {
        // Only update state from getSession if the real call returned
        const session = (sessionResult as { timedOut: false; result: { data: { session: Session | null } } }).result.data?.session ?? null;
        // Only overwrite if we got a real session OR if onAuthStateChange hasn't set one yet
        if (session || !get().session) {
          set({ session, user: session?.user ?? null });
        }

        if (session?.user && get().profile?.user_id !== session.user.id) {
          // Race fetchProfile against a 4s timeout
          await Promise.race([
            get().fetchProfile(),
            new Promise<void>(resolve => setTimeout(resolve, 4000)),
          ]);
        }
      } else {
        timedOut = true;
        console.warn('[Auth] getSession timed out — relying on onAuthStateChange for session state');
      }
    } catch (err) {
      // Invalid refresh token or network error — clear state and redirect to login
      console.warn('[Auth] Initialize error, clearing session:', err);
      set({ session: null, user: null, profile: null });
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    } finally {
      // Always mark loading as done — splash will always exit
      set({ loading: false });
    }
  },

  signOut: async () => {
    // Run comprehensive cleanup (includes Supabase signOut)
    await cleanupOnLogout();
    // Reset auth store state
    set({ session: null, user: null, profile: null, loading: false });
  },
}));
