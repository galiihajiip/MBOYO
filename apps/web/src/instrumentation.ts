/**
 * Next.js instrumentation hook (BLOCK 28) — register() runs once per
 * server runtime (nodejs and edge) at process start, before any request is
 * handled. Used here only to conditionally init Sentry server-side (a
 * no-op when SENTRY_DSN is unset — see lib/observability/sentry.server.ts).
 */
import * as Sentry from "@sentry/nextjs";
import { initSentryServer } from "./lib/observability/sentry.server";

export function register(): void {
  initSentryServer();
}

export const onRequestError = Sentry.captureRequestError;
