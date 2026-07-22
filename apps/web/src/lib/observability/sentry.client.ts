/**
 * Browser-side Sentry init (BLOCK 28) — conditionally initialized: does
 * nothing at all when NEXT_PUBLIC_SENTRY_DSN is unset, matching this
 * codebase's "the app works with zero optional-feature configuration"
 * posture (same pattern as PushOptIn.tsx's VAPID check). next.config.ts's
 * CSP connect-src already allowlists this DSN's ingest origin when set —
 * see that file's own comment, which references this file by name.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // No session replay, no PII-capturing integrations enabled — this app's
    // logger (lib/observability/logger.ts) already has its own redaction
    // rules; Sentry's defaults (sendDefaultPii) are left off deliberately
    // so an unhandled exception's breadcrumbs don't leak request bodies
    // containing report descriptions/coordinates/evidence paths.
    sendDefaultPii: false,
  });
}
