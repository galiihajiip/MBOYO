import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Security headers (BLOCK 28) — applied to every response via next.config.ts's
 * headers() rather than proxy.ts, so they apply uniformly to static assets,
 * API routes, and pages alike without needing route-matching logic.
 *
 * The CSP's connect-src/img-src must allow: Supabase (API + Realtime
 * websocket, both derived from NEXT_PUBLIC_SUPABASE_URL), the MapLibre demo
 * tile fallback (components/map/MapPin.tsx et al. hardcode
 * https://demotiles.maplibre.org/style.json as their fallback style — see
 * that file's own comment), and an optional self-hosted/third-party map
 * tile provider (NEXT_PUBLIC_MAP_STYLE_URL, unknown host at build time — so
 * this CSP allows any https: origin for img-src/connect-src for map tiles
 * specifically, since a strict per-host allowlist can't be computed for an
 * admin-configurable style URL without hardcoding a specific provider this
 * project doesn't have one of). Sentry's ingest endpoint (NEXT_PUBLIC_SENTRY_DSN)
 * is also connect-src'd when configured — see lib/observability/sentry.client.ts.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, "ws");

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
const sentryIngestOrigin = sentryDsn ? new URL(sentryDsn).origin : "";

const cspDirectives = [
  `default-src 'self'`,
  // Next.js requires 'unsafe-inline' for its own injected style tags and
  // (in dev) inline scripts for Fast Refresh — 'unsafe-eval' is scoped to
  // development only, never shipped to a production CSP.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https: wss:${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseWsOrigin}` : ""}${sentryIngestOrigin ? ` ${sentryIngestOrigin}` : ""}`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspDirectives },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Camera/geolocation ARE used by this app (Reporter's photo
            // capture / GPS capture) — deliberately NOT disabled here, only
            // the features this app never uses are locked down.
            value: "microphone=(), payment=(), usb=(), interest-cohort=()",
          },
          // HSTS is only meaningful over HTTPS (production/staging) — sent
          // unconditionally is safe (browsers ignore it over plain HTTP),
          // but a preload submission is deliberately NOT requested here
          // (that's an irreversible, domain-wide, out-of-band decision the
          // app owner must make deliberately, not something a framework
          // config should default into).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

// withSentryConfig instruments the build (source-map upload, request
// tracing wrappers) whenever SENTRY_DSN is configured. Uploading source
// maps additionally requires SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN
// (Sentry's own release-tooling variables, distinct from the app's own
// SENTRY_DSN) — silent: true suppresses that step's console noise rather
// than failing when those aren't set, since a demo/hackathon deployment
// may run with error reporting on but release source-map upload off.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, { silent: true, disableLogger: true })
  : nextConfig;
