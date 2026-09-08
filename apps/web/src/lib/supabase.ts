import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client — the backend for OpenField auth, cloud project storage,
 * analytics, and feedback.
 *
 * The app is local-first: if the Supabase env vars are not configured the
 * client is `null` and every feature that depends on it degrades gracefully
 * (auth screens explain it's unavailable, analytics/feedback no-op, projects
 * stay local-only). This keeps the editor fully usable offline.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "openfield-auth",
      },
    })
  : null;

/** Throws a helpful error if code paths that require Supabase are hit while unconfigured. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local.",
    );
  }
  return supabase;
}
