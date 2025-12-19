import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { cleanupOnLogout } from '@/utils/logoutCleanup';

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  emergency_contact: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  documents_submitted: boolean;
  submission_date: string | null;
  rejection_reason: string | null;
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
      set({ profile: data as Profile });
    } else {
      set({ profile: null });
    }
  },

  initialize: async () => {
    set({ loading: true });

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null });

    if (session?.user) {
      await get().fetchProfile();
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null });
      
      if (session?.user) {
        await get().fetchProfile();
      } else {
        set({ profile: null });
      }
    });

    set({ loading: false });
  },

  signOut: async () => {
    // Run comprehensive cleanup (includes Supabase signOut)
    await cleanupOnLogout();
    // Reset auth store state
    set({ session: null, user: null, profile: null, loading: false });
  },
}));
