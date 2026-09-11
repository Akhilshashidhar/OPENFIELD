/**
 * Google Analytics 4 (gtag.js) sink.
 *
 * Loads the official gtag.js snippet lazily and safely. This is an additional
 * analytics sink alongside PostHog and Supabase (see hooks/useAnalytics.ts).
 *
 * Design goals:
 *  - Production-safe: never throws, never blocks the UI. If GA fails to load,
 *    the app keeps working normally.
 *  - Opt-in via the public `VITE_GA_MEASUREMENT_ID` env var. When it is unset
 *    (e.g. local dev with no config), GA is completely inert.
 *  - No duplicate page_view events: `send_page_view` is disabled so page views
 *    are only sent explicitly via `gaPageView()` (the app already emits a
 *    manual page_view on every route change).
 *  - No PII: only the caller-provided, non-sensitive event parameters are sent.
 */

type EventParams = Record<string, string | number | boolean | null | undefined>;

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as
  | string
  | undefined;

// In local development we don't want to pollute production analytics. GA only
// runs in a real browser on a production build. `import.meta.env.PROD` is true
// for `vite build` output and false for `vite` dev server.
const isBrowser = typeof window !== "undefined";
const isEnabled = Boolean(measurementId) && isBrowser && import.meta.env.PROD;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

function ensureGtag(): boolean {
  if (!isEnabled || !measurementId) return false;
  if (loaded) return true;

  try {
    window.dataLayer = window.dataLayer || [];
    // gtag pushes its own `arguments` object onto the dataLayer.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };

    window.gtag("js", new Date());
    // Disable automatic page_view — the app sends page views manually via
    // gaPageView() so we don't double-count on the initial load + route change.
    window.gtag("config", measurementId, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    // The app ships `Cross-Origin-Embedder-Policy: require-corp` (public/_headers)
    // to enable threaded WASM. Under COEP, cross-origin subresources must be
    // fetched in CORS mode; loading gtag.js in CORS mode (Google serves the
    // needed CORS headers) prevents COEP from blocking the script.
    script.crossOrigin = "anonymous";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      measurementId,
    )}`;
    // Failing to load must never break the app; swallow errors silently.
    script.onerror = () => {
      /* GA blocked (ad-blocker/offline/COEP) — app continues normally. */
    };
    document.head.appendChild(script);

    loaded = true;
    return true;
  } catch {
    // Never let analytics setup throw.
    return false;
  }
}

/** Send a custom event to GA4. No-op when GA is not configured/enabled. */
export function gaTrack(event: string, params?: EventParams): void {
  try {
    if (!ensureGtag()) return;
    window.gtag?.("event", event, params ?? {});
  } catch {
    /* analytics must never throw */
  }
}

/** Send an explicit page_view to GA4. */
export function gaPageView(path?: string): void {
  try {
    if (!ensureGtag()) return;
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_location: isBrowser ? window.location.href : undefined,
      page_title: isBrowser ? document.title : undefined,
    });
  } catch {
    /* analytics must never throw */
  }
}

/**
 * Associate subsequent events with a stable user id. Only a non-PII id is sent
 * (never email/name). No-op when GA is not configured/enabled.
 */
export function gaIdentify(userId: string): void {
  try {
    if (!ensureGtag() || !measurementId) return;
    window.gtag?.("config", measurementId, {
      user_id: userId,
      send_page_view: false,
    });
  } catch {
    /* analytics must never throw */
  }
}

export const isGaEnabled = isEnabled;
