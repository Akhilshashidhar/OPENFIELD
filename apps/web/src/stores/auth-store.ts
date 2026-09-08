import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { trackEvent } from "../hooks/useAnalytics";

export interface AuthProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  plan: string;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  /** true when sign-up succeeded but email confirmation is still required */
  needsEmailConfirmation?: boolean;
}

interface AuthState {
  /** Whether a backend is configured at all. */
  configured: boolean;
  /** Still resolving the initial session on boot. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;

  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

let initialized = false;

function toProfileFromUser(user: User | null): AuthProfile | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName:
      (meta.display_name as string | undefined) ??
      (user.email ? user.email.split("@")[0] : null),
    avatarUrl: (meta.avatar_url as string | undefined) ?? null,
    plan: "free",
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  configured: isSupabaseConfigured,
  loading: isSupabaseConfigured,
  session: null,
  user: null,
  profile: null,

  initialize: async () => {
    if (initialized) return;
    initialized = true;

    if (!supabase) {
      set({ configured: false, loading: false });
      return;
    }

    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      profile: toProfileFromUser(data.session?.user ?? null),
      loading: false,
    });

    // Hydrate the richer profile row (plan, display name) in the background.
    void get().refreshProfile();

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        profile: toProfileFromUser(session?.user ?? null),
      });
      void get().refreshProfile();
    });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!supabase || !user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("email, display_name, avatar_url, plan")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data) return;
    set((s) => ({
      profile: {
        id: user.id,
        email: (data.email as string | null) ?? s.profile?.email ?? null,
        displayName:
          (data.display_name as string | null) ??
          s.profile?.displayName ??
          null,
        avatarUrl: (data.avatar_url as string | null) ?? null,
        plan: (data.plan as string | null) ?? "free",
      },
    }));
  },

  signInWithGoogle: async () => {
    if (!supabase) return { ok: false, error: "Backend not configured." };
    trackEvent("signed_in", { method: "google" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // IMPORTANT: do NOT append a routing hash (e.g. #/welcome) here.
        // Supabase returns the OAuth tokens in the URL *hash* fragment and
        // parses them via detectSessionInUrl. A routing hash would collide with
        // that and the session would never be established (user bounces back to
        // the landing page). Redirect to a clean origin; the router defaults to
        // the "welcome" route, and onAuthStateChange picks up the session.
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}${window.location.pathname}`
            : undefined,
        queryParams: { prompt: "select_account" },
      },
    });
    // On success the browser redirects to Google, so we won't reach past here.
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  signInWithPassword: async (email, password) => {
    if (!supabase) return { ok: false, error: "Backend not configured." };
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    trackEvent("signed_in", { method: "password" });
    return { ok: true };
  },

  signUpWithPassword: async (email, password, displayName) => {
    if (!supabase) return { ok: false, error: "Backend not configured." };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: displayName ? { display_name: displayName.trim() } : undefined,
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) return { ok: false, error: error.message };
    trackEvent("signed_up", { method: "password" });
    // If email confirmation is on, there's a user but no active session yet.
    const needsEmailConfirmation = Boolean(data.user && !data.session);
    return { ok: true, needsEmailConfirmation };
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));

/** Convenience selector hooks. */
export const useIsAuthenticated = () => useAuthStore((s) => Boolean(s.session));
export const useAuthUser = () => useAuthStore((s) => s.user);
