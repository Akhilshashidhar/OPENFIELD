import { supabase } from "../lib/supabase";

/**
 * Supabase analytics sink. Fire-and-forget inserts into `analytics_events`.
 * Anonymous events are allowed (see analytics RLS insert policy). Failures are
 * swallowed so analytics never breaks the app.
 */

type EventProperties = Record<string, string | number | boolean | null>;

// A stable per-tab session id so events can be grouped without cookies.
let sessionId: string | null = null;
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    const key = "openfield-analytics-session";
    const existing = sessionStorage.getItem(key);
    if (existing) {
      sessionId = existing;
    } else {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(key, sessionId);
    }
  } catch {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

export function trackToSupabase(
  event: string,
  properties?: EventProperties,
): void {
  if (!supabase) return;
  void (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      await supabase.from("analytics_events").insert({
        user_id: data.user?.id ?? null,
        event,
        properties: (properties ?? {}) as never,
        session_id: getSessionId(),
      });
    } catch {
      // ignore — analytics must never throw
    }
  })();
}

export const isSupabaseAnalyticsEnabled = Boolean(supabase);
