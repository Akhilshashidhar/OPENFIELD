/**
 * Cloudflare Pages Function: API proxy for third-party services.
 *
 * Routes requests from the browser to ElevenLabs, OpenAI, and Anthropic
 * so that API keys never leave the same origin in production.
 *
 * URL pattern: /api/proxy/<service>/<path>
 *   e.g. POST /api/proxy/elevenlabs/text-to-speech/abc123
 *        POST /api/proxy/openai/chat/completions
 *        POST /api/proxy/anthropic/messages
 *
 * The API key is passed via the `x-proxy-api-key` header and translated
 * to the correct service-specific header before forwarding.
 */

interface ServiceConfig {
  baseUrl: string;
  allowedPaths: RegExp;
  authHeaders: (key: string) => Record<string, string>;
}

const SERVICE_CONFIG: Record<string, ServiceConfig> = {
  elevenlabs: {
    baseUrl: "https://api.elevenlabs.io/v1",
    allowedPaths: /^(voices|models|text-to-speech\/[\w-]+)$/,
    authHeaders: (key) => ({ "xi-api-key": key }),
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    allowedPaths: /^(chat\/completions|models)$/,
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    allowedPaths: /^(messages)$/,
    authHeaders: (key) => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    }),
  },
};

/**
 * Origins allowed to call this proxy from a browser.
 *
 * Production is openfield.co.in. The legacy Cloudflare Pages preview domains
 * and localhost dev/preview ports are kept so existing deploys and local
 * development keep working. Additional origins can be added at deploy time via
 * the `ALLOWED_ORIGINS` environment variable (comma-separated) without a code
 * change — see resolveAllowedOrigins().
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://openfield.co.in",
  "https://www.openfield.co.in",
  // Cloudflare Pages project preview/prod aliases (kept for existing deploys).
  "https://openfield.pages.dev",
  "https://openreel.pages.dev",
  "https://openreel-preview.pages.dev",
  // Local development (Vite dev server + vite preview).
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/**
 * Merge the built-in allowlist with any origins provided via the
 * `ALLOWED_ORIGINS` env var (comma-separated). Trailing slashes and blank
 * entries are ignored. Returns a Set for O(1) exact-match lookups.
 */
function resolveAllowedOrigins(env: Record<string, unknown> | undefined): Set<string> {
  const extra = typeof env?.ALLOWED_ORIGINS === "string" ? env.ALLOWED_ORIGINS : "";
  const fromEnv = extra
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter((o) => o.length > 0);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]);
}

const MAX_REQUEST_BODY_BYTES = 8_388_608; // 8 MB (agent tool/state payloads)
const UPSTREAM_TIMEOUT_MS = 120_000;

class BodyTooLargeError extends Error {}

/**
 * Buffer a request body while enforcing a byte cap — so the limit holds for
 * chunked/streamed transfers too, not just when Content-Length is present.
 */
async function readBodyCapped(
  request: Request,
  max: number,
): Promise<ArrayBuffer | undefined> {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

function getCorsHeaders(
  request: Request,
  allowedOrigins: Set<string>,
): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-proxy-api-key",
    // Responses vary per Origin, so caches must not reuse one origin's CORS
    // headers for another.
    Vary: "Origin",
  };
  // Only reflect the caller's origin when it is explicitly allowlisted. If it
  // is not (or absent), we deliberately omit Access-Control-Allow-Origin so the
  // browser blocks the cross-origin read — we never echo a *different* allowed
  // origin, which would neither help the real caller nor authorize the unknown
  // one. We never use "*", so credentials/keys are never exposed cross-origin.
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonError(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const onRequest: PagesFunction = async (context) => {
  const allowedOrigins = resolveAllowedOrigins(
    context.env as Record<string, unknown> | undefined,
  );
  const corsHeaders = getCorsHeaders(context.request, allowedOrigins);

  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const pathParts = context.params.catchall as string[];
  if (!pathParts || pathParts.length < 1) {
    return jsonError("Missing service in URL path", 400, corsHeaders);
  }

  const service = pathParts[0];
  const remainingPath = pathParts.slice(1).join("/");

  if (remainingPath.includes("..") || remainingPath.includes("//")) {
    return jsonError("Invalid path", 400, corsHeaders);
  }

  const config = SERVICE_CONFIG[service];
  if (!config) {
    return jsonError(`Unknown service: ${service}`, 400, corsHeaders);
  }

  if (remainingPath && !config.allowedPaths.test(remainingPath)) {
    return jsonError("Path not allowed for this service", 403, corsHeaders);
  }

  const apiKey = context.request.headers.get("x-proxy-api-key");
  if (!apiKey) {
    return jsonError("Missing x-proxy-api-key header", 401, corsHeaders);
  }

  // Fast-path reject on a declared oversized body; the streaming cap below is
  // the authoritative check (covers chunked transfers with no Content-Length).
  if (context.request.headers.has("Content-Length")) {
    const contentLength = parseInt(
      context.request.headers.get("Content-Length") ?? "0",
      10,
    );
    if (contentLength > MAX_REQUEST_BODY_BYTES) {
      return jsonError("Request body too large", 413, corsHeaders);
    }
  }

  let requestBody: ArrayBuffer | undefined;
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    try {
      requestBody = await readBodyCapped(context.request, MAX_REQUEST_BODY_BYTES);
    } catch (err) {
      if (err instanceof BodyTooLargeError) {
        return jsonError("Request body too large", 413, corsHeaders);
      }
      throw err;
    }
  }

  const originalUrl = new URL(context.request.url);
  const targetUrl = remainingPath
    ? `${config.baseUrl}/${remainingPath}${originalUrl.search}`
    : `${config.baseUrl}${originalUrl.search}`;

  const upstreamHeaders = new Headers();
  const contentType = context.request.headers.get("Content-Type");
  if (contentType) {
    upstreamHeaders.set("Content-Type", contentType);
  }
  for (const [key, value] of Object.entries(config.authHeaders(apiKey))) {
    upstreamHeaders.set(key, value);
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: context.request.method,
      headers: upstreamHeaders,
      body: requestBody,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === "TimeoutError"
        ? "Upstream request timed out"
        : "Failed to reach upstream service";
    return jsonError(message, 502, corsHeaders);
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    responseHeaders.set(key, value);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
};
