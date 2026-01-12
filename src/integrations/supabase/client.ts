import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

// 👇 THIS FIXES ANDROID WEBVIEW CORS
const customFetch = (...args: Parameters<typeof fetch>) => fetch(...args);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: customFetch,
  },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
