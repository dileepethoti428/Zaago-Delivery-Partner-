import { createClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Mobile-safe storage adapter
 * Uses Capacitor Preferences (native Android SharedPreferences / iOS NSUserDefaults)
 * Persists reliably across app restarts, unlike localStorage which can be cleared by the OS
 */
const capacitorStorage = {
  getItem: async (key: string) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: capacitorStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
