# MBOYO Observability

BLOCK 28 deliverable. Documents the structured logging, correlation ID, error-tracking, and health-metric mechanisms actually implemented across `apps/web`, `apps/worker`, and `apps/ml-api` — not an aspirational spec. Complements [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)'s Observability section (tier framing) and [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) (service topology).

## Structured logging

Every service emits one JSON object per log line to stdout — no external logging library, since none of the three services has log-shipping infrastructure configured (a stdlib/console formatter is sufficient for a single process per deployment target):

| Service | Implementation | Entry point |
|---|---|---|
| `apps/web` | [`lib/observability/logger.ts`](../../apps/web/src/lib/observability/logger.ts) — `logger.debug/info/warn/error(message, fields)` | Call sites throughout `apps/web/src/lib/` |
| `apps/worker` | [`worker/logging_setup.py`](../../apps/worker/worker/logging_setup.py) — `configure_json_logging()` replaces stdlib `logging.basicConfig` | `worker/main.py`, called once at process start |
| `apps/ml-api` | [`app/logging_setup.py`](../../apps/ml-api/app/logging_setup.py) — same shape as the worker's | `app/main.py`, called once at module load |

Every log line has the shape:

```json
{"timestamp": "2026-07-27T12:00:00.000Z", "level": "info", "service": "apps/web", "message": "report created", "requestId": "..."}
```

Existing `logging.getLogger(...).info(..., extra={...})` call sites in `apps/worker`/`apps/ml-api` needed **no changes** — `configure_json_logging()`/its ml-api equivalent only changes how the root logger renders records, not any call site.

### Redaction

All three loggers apply the same rules before serializing a log line, so "logs must not contain secrets or raw image bytes" is enforced once per service, not left to each call site's discipline:

- Any field whose key matches `password|token|secret|key|authorization|cookie|dsn` (case-insensitive) is replaced with `"[redacted]"`.
- A fixed PII denylist (`email`, `phone`, `phoneNumber`, `address`, `sha256Hash`, `perceptualHash`) is redacted even when the key doesn't look secret-shaped.
- Redaction recurses into nested objects and arrays.
- Any raw binary value (`ArrayBuffer`/`ArrayBuffer`-view in TypeScript; `bytes`/`bytearray` in Python) is replaced with `"[binary N bytes omitted]"` — a defensive rule, since no call site in this codebase should ever pass raw image bytes to a log call, but this makes that invariant structural rather than trusted.
- Formatting never throws: an unserializable field value degrades to `"[unserializable]"` for that field, or the whole line degrades to a minimal fallback if `JSON.stringify`/`json.dumps` itself fails — a broken log call must never crash the caller.

Verified by unit tests: `apps/web/src/lib/observability/logger.test.ts`, `apps/worker/tests/test_logging_setup.py`, `apps/ml-api/tests/test_logging_setup.py`.

## Correlation IDs

- **Within `apps/web`**: every API route resolves a request ID via [`lib/api/request-id.ts`](../../apps/web/src/lib/api/request-id.ts)'s `resolveRequestId()` — reuses an inbound `x-request-id` header if a caller already set one, otherwise mints a fresh UUID. Threaded through every `ApiResult` response.
- **`apps/web` → `apps/worker` → `apps/ml-api`, end to end (BLOCK 28)**: the evidence-upload route ([`app/api/reports/evidence/route.ts`](../../apps/web/src/app/api/reports/evidence/route.ts)) now writes its own `requestId` onto the `analysis_jobs` row it creates (`analysis_jobs.request_id`, added by `supabase/migrations/20260727080001_analysis_jobs_request_id.sql`). `apps/worker`'s claim loop reads that value back (`worker/claim_loop.py` → `AnalysisJob.request_id`) and, in `worker/processing.py`, uses it (falling back to a fresh UUID only if absent — e.g. a job created by future admin/demo tooling with no originating web request) for every `apps/ml-api` call it makes for that job. **This means one report's full web → worker → ml-api trace can be reconstructed by filtering structured logs on a single `requestId` value.**
- `apps/ml-api`'s own request-id handling ([`app/request_context.py`](../../apps/ml-api/app/request_context.py)) mirrors `apps/web`'s `request-id.ts` exactly (same header name, same mint-or-echo semantics) and was already in place before this block.

## Error tracking (Sentry)

Conditionally initialized in all three services — a no-op with zero configuration required, matching this codebase's "the app works with zero optional-feature configuration" posture (same pattern as `PushOptIn.tsx`'s VAPID check):

| Service | Init file | Condition |
|---|---|---|
| `apps/web` (browser) | [`lib/observability/sentry.client.ts`](../../apps/web/src/lib/observability/sentry.client.ts), loaded via `src/instrumentation-client.ts` | `NEXT_PUBLIC_SENTRY_DSN` set |
| `apps/web` (server) | [`lib/observability/sentry.server.ts`](../../apps/web/src/lib/observability/sentry.server.ts), called from `src/instrumentation.ts`'s `register()` | `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`) set |
| `apps/worker` | [`worker/observability.py`](../../apps/worker/worker/observability.py), called from `worker/main.py`'s `run()` | `SENTRY_DSN` set |
| `apps/ml-api` | [`app/observability.py`](../../apps/ml-api/app/observability.py), called from `app/main.py`'s `lifespan()` | `SENTRY_DSN` set |

All four inits set `sendDefaultPii`/`send_default_pii: False` explicitly (not left at whatever the SDK's own default happens to be) — an unhandled exception's captured request context must never include report descriptions, coordinates, or evidence paths. `apps/web/next.config.ts` wraps `nextConfig` with `withSentryConfig` (source-map upload, request tracing) only when `SENTRY_DSN` is set, with `silent: true` since a demo/hackathon deployment may run with error reporting on but Sentry release tooling (`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) unconfigured.

## Health / service metrics

Surfaced on the Admin's Kesehatan Sistem dashboard (`apps/web/src/app/admin/kesehatan/page.tsx`), backed by [`lib/admin/analytics.ts`](../../apps/web/src/lib/admin/analytics.ts)'s `getServiceHealthSummary()`:

- **Queue depth by status**: `analysis_jobs` counts for `queued`/`processing`/`failed` (BLOCK 26).
- **Recent failures**: last 20 failed jobs with report ID, error message, attempt count (BLOCK 26).
- **Median job duration** (BLOCK 28): `completed_at - created_at` over `'done'` jobs completed in the last 7 days. `null` when no jobs completed in that window — not zero, which would be misleading.
- **Median model latency** (BLOCK 28): `apps/ml-api`'s reported `/predict` `latency_ms`, persisted by `apps/worker` onto `model_predictions.model_latency_ms` (new column, `supabase/migrations/20260727080002_model_prediction_latency.sql`) at record time, aggregated over the last 7 days.
- **Escalation count** (BLOCK 28): count of `audit_events` with `action like 'escalation.%'` in the last 7 days — `evaluate_escalations()` (BLOCK 25) appends exactly one such event per newly-raised (deduplicated) escalation, so this is an exact count of real escalations raised, not an approximation.
- **Evidence download failure count** (BLOCK 28): failed `analysis_jobs` in the last 7 days whose error message matches the exact prefixes `worker/processing.py`'s `_fail_job()` uses for the two evidence-related failure paths (`"Evidence download failed:"`, `"No report_evidence row found"`). This codebase has no dedicated upload-failure log table — this is disclosed as a subset of `analysisJobsFailed`, not a general upload-failure counter, matching this document's own "don't overclaim" posture.

All four BLOCK 28 metrics are computed as TypeScript aggregation over small raw-row Supabase queries (median/count over query results), the same pattern `getVerifierAnalytics()` (BLOCK 26) established — no dedicated SQL summary view exists for any of them, since none has proven necessary at this data volume.

## What this document does not claim

- No `/metrics` endpoint or Prometheus/OpenTelemetry integration in any service — metrics are queried on demand from application tables, not scraped from a running process.
- No log aggregation/shipping pipeline (e.g. to a centralized log store) — structured JSON to stdout is the full extent of the logging infrastructure; an operator is expected to capture stdout via their own deployment platform's mechanism (container log driver, systemd journal, etc.).
- No alerting on any of the health metrics above — they are dashboard-only, read by a System Administrator on demand.
