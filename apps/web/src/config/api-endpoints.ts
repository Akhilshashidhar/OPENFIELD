/**
 * Centralized API endpoint configuration.
 *
 * All external service URLs should be defined here so they can be
 * swapped for different environments or self-hosted instances.
 */

const isDev = import.meta.env.DEV;

/**
 * OpenField cloud services (sharing + cloud templates).
 *
 * Configure via VITE_OPENFIELD_CLOUD_URL. There is intentionally NO OpenReel
 * fallback: if this is unset in production, cloud sharing/templates are simply
 * unavailable (the share/template services fail gracefully). In dev it defaults
 * to a local worker at http://localhost:8787.
 *
 * When empty, OPENFIELD_CLOUD_URL === "" and dependent fetches will no-op/fail
 * rather than call any OpenReel infrastructure.
 */
export const OPENFIELD_CLOUD_URL =
  (import.meta.env.VITE_OPENFIELD_CLOUD_URL as string | undefined) ??
  (isDev ? "http://localhost:8787" : "");

/** True when a cloud endpoint is configured (sharing/templates available). */
export const IS_OPENFIELD_CLOUD_CONFIGURED = OPENFIELD_CLOUD_URL.length > 0;

/**
 * Third-party API base URLs.
 * These are used by the api-proxy service in dev mode (direct calls)
 * and by the Cloudflare Pages Function proxy in production.
 * Application code should use apiFetch() from services/api-proxy.ts
 * instead of importing these directly.
 */
