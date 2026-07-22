/**
 * Server-runtime Sentry init (BLOCK 28) — conditionally initialized:
 * no-op when SENTRY_DSN is unset. Called from instrumentation.ts's
 * register() for the nodejs/edge runtimes; kept in this separate module
 * (rather than inline in instrumentation.ts) purely so the client/server
 * init logic reads the same way as a matched pair, mirroring
 * sentry.client.ts.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export function initSentryServer(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
