/**
 * Next.js client instrumentation entry point (BLOCK 28) — Next.js loads
 * this file automatically on the client before any other client code runs.
 * Delegates entirely to sentry.client.ts's conditional init.
 */
import "./lib/observability/sentry.client";
