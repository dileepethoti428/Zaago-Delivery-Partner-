import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupOnLogout } from '@/utils/logoutCleanup';
import { ensureAgentExists, syncLocationAfterAuth } from '@/utils/postAuthInit';
import { registerFCMToken } from '@/utils/fcm';

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
  isActive?: boolean;
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
    if (!user) return;

    set({ profileState: 'loading' });

    try {
      const [profileRes, agentRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('delivery_agents').select('is_active').eq('agent_id', user.id).maybeSingle(),
      ]);

      if (profileRes.data) {
        set({
          profile: {
            ...(profileRes.data as Profile),
            isActive: agentRes.data?.is_active ?? true,
          },
          profileState: 'ready',
        });
      } else {
        set({ profile: null, profileState: 'missing' });
      }
    } catch (err) {
      console.warn('[Auth] Profile fetch error:', err);
      set({ profileState: 'error' });
    }
  },

  initialize: async () => {
    set({ loading: true });

    // 1️⃣ Register listener FIRST so no auth event is missed
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State change:', event);

      set({ session, user: session?.user ?? null, loading: false });

      if (session?.user) {
        set({ profile: null, profileState: 'loading' });
        get().fetchProfile().catch(() => {});

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          Promise.resolve().then(async () => {
            try {
              console.log('[AuthInit] Running post-auth initialization...');
              await ensureAgentExists();
              registerFCMToken();
              syncLocationAfterAuth();
            } catch (e) {
              console.warn('[AuthInit] Non-blocking init error:', e);
            }
          });
        }
      } else {
        set({ profile: null, profileState: 'idle' });
      }
    });

    // 2️⃣ THEN check existing session (covers cold start if INITIAL_SESSION fires before listener)
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      set({ session, user: session.user, loading: false });
      set({ profile: null, profileState: 'loading' });
      get().fetchProfile().catch(() => {});
    }
  },

  signOut: async () => {
    await cleanupOnLogout();
    set({ session: null, user: null, profile: null, profileState: 'idle', loading: false });
  },
}));
