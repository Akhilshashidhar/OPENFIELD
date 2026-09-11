import { useCallback } from "react";
import {
  trackToSupabase,
  isSupabaseAnalyticsEnabled,
} from "../services/analytics-sink";
import { gaTrack, gaPageView, gaIdentify, isGaEnabled } from "../services/ga";

type EventProperties = Record<string, string | number | boolean | null>;

/**
 * Forward an event to Google Analytics 4. `page_view` is mapped to GA's
 * explicit page_view so it isn't double-counted (gtag auto page_view is off).
 */
function trackToGa(event: string, properties?: EventProperties): void {
  if (event === "page_view") {
    const route = properties?.route;
    gaPageView(typeof route === "string" ? route : undefined);
    return;
  }
  gaTrack(event, properties);
}

const analyticsKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const analyticsHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;
let analyticsClientPromise: Promise<typeof import("posthog-js").default | null> | null = null;

function getAnalyticsClient(): Promise<typeof import("posthog-js").default | null> {
  if (!analyticsKey || !analyticsHost) return Promise.resolve(null);
  if (!analyticsClientPromise) {
    analyticsClientPromise = import("posthog-js").then(({ default: client }) => {
      client.init(analyticsKey, {
        api_host: analyticsHost,
        capture_pageview: true,
        capture_pageleave: true,
      });
      return client;
    });
  }
  return analyticsClientPromise;
}

export function useAnalytics() {
  const track = useCallback(
    (event: string, properties?: EventProperties) => {
      // PostHog (if configured) …
      void getAnalyticsClient().then((client) => client?.capture(event, properties));
      // … the Supabase analytics_events table (if configured) …
      trackToSupabase(event, properties);
      // … and Google Analytics 4 (if configured).
      trackToGa(event, properties);
    },
    [],
  );

  const identify = useCallback(
    (userId: string, properties?: EventProperties) => {
      void getAnalyticsClient().then((client) => client?.identify(userId, properties));
      gaIdentify(userId);
    },
    [],
  );

  return {
    track,
    identify,
    isEnabled:
      Boolean(analyticsKey && analyticsHost) ||
      isSupabaseAnalyticsEnabled ||
      isGaEnabled,
  };
}

/** Non-hook tracker for use outside React (services, stores). */
export function trackEvent(event: string, properties?: EventProperties): void {
  void getAnalyticsClient().then((client) => client?.capture(event, properties));
  trackToSupabase(event, properties);
  trackToGa(event, properties);
}

export const AnalyticsEvents = {
  // ── Already wired and firing today ─────────────────────────────
  PROJECT_CREATED: "project_created", // WelcomeScreen / StartFromScratch / createNewProject
  PROJECT_OPENED: "project_opened", // RecentProjects (recover/open)
  PROJECT_EXPORTED: "project_exported", // Toolbar export completion
  CLIP_ADDED: "clip_added",
  TEXT_ADDED: "text_added",
  EFFECT_APPLIED: "effect_applied",
  PARTICLE_EFFECT_ADDED: "particle_effect_added",
  TEMPLATE_USED: "template_used",

  // ── Launch product-event catalog (single source of truth) ──────
  // Auth events below are emitted from stores/auth-store.ts today as
  // "signed_in" / "signed_up" / "logged_out". These aliases document the
  // canonical launch names; do not double-emit.
  SIGNUP_COMPLETED: "signed_up", // auth-store.signUpWithPassword (already fires)
  LOGIN: "signed_in", // auth-store.signIn* (already fires)
  LOGOUT: "logged_out", // auth-store.signOut (already fires)

  // The following correspond to real actions that are NOT yet instrumented.
  // Wire each with a single trackEvent(...) call at the noted location when
  // ready — the utility already fans out to GA4 + PostHog + Supabase.
  //   EDITOR_OPENED   → App.tsx, when route === "editor" is first mounted
  //   MEDIA_UPLOADED  → stores/project/media-slice.ts importMedia() on success
  //                     (send only mime/type + size bucket, never file contents)
  //   AI_AGENT_USED   → services/agent loop begin() (send tool/domain, no prompt text)
  //   EXPORT_STARTED  → components/editor/Toolbar.tsx runExport() start
  //   SIGNUP_STARTED  → the signup form submit handler (before supabase.auth.signUp)
  EDITOR_OPENED: "editor_opened",
  MEDIA_UPLOADED: "media_uploaded",
  AI_AGENT_USED: "ai_agent_used",
  EXPORT_STARTED: "export_started",
  SIGNUP_STARTED: "signup_started",
} as const;
