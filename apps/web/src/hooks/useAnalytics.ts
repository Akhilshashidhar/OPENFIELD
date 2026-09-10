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
  PROJECT_CREATED: "project_created",
  PROJECT_OPENED: "project_opened",
  PROJECT_EXPORTED: "project_exported",
  CLIP_ADDED: "clip_added",
  TEXT_ADDED: "text_added",
  EFFECT_APPLIED: "effect_applied",
  PARTICLE_EFFECT_ADDED: "particle_effect_added",
  TEMPLATE_USED: "template_used",
} as const;
