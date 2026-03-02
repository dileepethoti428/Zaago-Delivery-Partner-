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
      } else {
        console.warn('[Auth] Profile fetch returned no data:', profileRes.error?.message);
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
    set({ loading: true, profileState: 'idle' });

    // Register listener FIRST (before getSession) — Supabase docs requirement.
    // INITIAL_SESSION fires synchronously from localStorage on most app opens.
    if (!listenerRegistered) {
      listenerRegistered = true;

      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);

        if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, profile: null, profileState: 'idle' });
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

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
        if (event === 'INITIAL_SESSION') {
          initialSessionReceived = true;
        }

        // Only update state if session actually changed (prevents LocationSync restarts)
        const currentSession = get().session;
        if (currentSession?.access_token !== session?.access_token) {
          set({ session, user: session?.user ?? null });
        }

        if (session?.user) {
          // Skip fetchProfile if we already have a profile for this user
          if (get().profile?.user_id !== session.user.id) {
            if (event === 'INITIAL_SESSION') {
              // Block loading until profile is ready (with 4s safety timeout)
              try {
                await Promise.race([
                  get().fetchProfile(),
                  new Promise<void>((_, reject) => setTimeout(() => reject(new Error('profile_timeout')), 4000)),
                ]);
              } catch (err: any) {
                console.warn('[Auth] INITIAL_SESSION profile fetch issue:', err?.message);
                if (get().profileState === 'loading') {
                  set({ profileState: 'error' });
                }
                // Exponential backoff retries: 2s, 4s, 8s
                const retryDelays = [2000, 4000, 8000];
                const scheduleRetry = (attempt: number) => {
                  if (attempt >= retryDelays.length) return;
                  setTimeout(() => {
                    if (get().profileState !== 'ready') {
                      console.log(`[Auth] Retrying profile fetch (attempt ${attempt + 1})...`);
                      get().fetchProfile()
                        .catch(() => scheduleRetry(attempt + 1));
                    }
                  }, retryDelays[attempt]);
                };
                scheduleRetry(0);
              }
              set({ loading: false });
              return;
            }
            get().fetchProfile().catch(console.warn);
          }
        } else {
          set({ profile: null, profileState: 'missing' });
        }

        if (event === 'INITIAL_SESSION') {
          set({ loading: false });
        }
      });
    }

    try {
      // Race getSession vs 5s timeout.
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
            try {
              await Promise.race([
                get().fetchProfile(),
                new Promise<void>((_, reject) => setTimeout(() => reject(new Error('profile_timeout')), 4000)),
              ]);
            } catch {
              if (get().profileState === 'loading') {
                set({ profileState: 'error' });
              }
              const retryDelays = [2000, 4000, 8000];
              const scheduleRetry = (attempt: number) => {
                if (attempt >= retryDelays.length) return;
                setTimeout(() => {
                  if (get().profileState !== 'ready') {
                    console.log(`[Auth] Retrying profile fetch (attempt ${attempt + 1})...`);
                    get().fetchProfile()
                      .catch(() => scheduleRetry(attempt + 1));
                  }
                }, retryDelays[attempt]);
              };
              scheduleRetry(0);
            }
          }
          set({ loading: false });
        }
      } else {
        if (!initialSessionReceived) {
          console.warn('[Auth] getSession timed out — continuing with existing session');
          set({ loading: false });
        }
      }
    } catch (err) {
      console.warn('[Auth] Initialize error, clearing session:', err);
      set({ session: null, user: null, profile: null, profileState: 'idle' });
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
    set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
  },
}));
