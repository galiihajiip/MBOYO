# MBOYO Security Checklist

BLOCK 28 deliverable. This is a working checklist of concrete controls actually implemented in this codebase, each with the file(s) that implement it — not a generic industry checklist copied in. It complements, and does not duplicate, [THREAT_MODEL.md](THREAT_MODEL.md) (adversarial threat modeling) and [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)'s Security section (tier framing). Where a control is intentionally partial or deferred, that's stated explicitly rather than left implicit — per this codebase's "disclose scope honestly rather than fake completeness" convention (see e.g. `deletion_requests`/`legal_holds`).

## HTTP security headers

- **Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security** — applied to every response via [`apps/web/next.config.ts`](../../apps/web/next.config.ts)'s `headers()`, not per-route, so static assets and API routes get the same baseline.
- CSP's `connect-src`/`img-src` allow a broader `https:` wildcard specifically to accommodate an admin-configurable map tile provider (`NEXT_PUBLIC_MAP_STYLE_URL`, unknown host at build time) — a deliberate, documented trade-off, not an oversight. Supabase's REST/Realtime origins and Sentry's ingest origin (when configured) are derived from env vars and appended explicitly.
- `script-src`'s `'unsafe-eval'` is scoped to non-production builds only (Next.js Fast Refresh requirement in dev).

## CSRF / same-origin enforcement

- Every mutating (`POST`/`PUT`/`PATCH`/`DELETE`) request to `/api/*` must carry an `Origin` (or `Referer`) header matching this deployment's own origin — checked in [`apps/web/src/proxy.ts`](../../apps/web/src/proxy.ts)'s `isSameOriginRequest()`, fails closed (denies) if neither header is present or if it doesn't match.
- Server Actions (e.g. the login action) get Next.js's own built-in Origin validation automatically (framework guarantee since Next 13.4+) — not re-implemented here.
- Session cookie is `sameSite: "lax"` (a real CSRF mitigation on its own) — the Origin check above is a second, independent layer, not the sole control.

## Session cookie attributes

- `secure: true` is forced in production for both the Server Component client ([`apps/web/src/lib/supabase/server.ts`](../../apps/web/src/lib/supabase/server.ts)) and the middleware client ([`apps/web/src/lib/supabase/middleware.ts`](../../apps/web/src/lib/supabase/middleware.ts)).
- `httpOnly` is deliberately **left at `@supabase/ssr`'s default (`false`)** — `createBrowserClient()` reads/writes this exact cookie directly via `document.cookie` (confirmed by reading the library's own source), so forcing `httpOnly: true` would break every Client Component's ability to read its own session. Making the auth cookie fully `httpOnly` would require replacing `@supabase/ssr`'s cookie-based browser session model entirely (e.g. a server-issued, short-lived exchange token) — a genuine architectural change, **explicitly out of this block's scope**, not a gap left unnoticed.

## Rate limiting

- **`apps/web`**: an in-process, sliding-fixed-window limiter ([`apps/web/src/lib/api/rate-limit.ts`](../../apps/web/src/lib/api/rate-limit.ts)) applied to report creation (30/min per profile), evidence upload (20/min per profile), and login (10/min per email+IP pair). Chosen over an external store (Redis) because this app runs as one long-lived process per deployment target — resets on process restart, does not coordinate across replicas if ever horizontally scaled. That trade-off is accepted for this deployment scale, not hidden.
- **`apps/ml-api`**: a separate in-process limiter ([`apps/ml-api/app/rate_limit.py`](../../apps/ml-api/app/rate_limit.py)), keyed by client IP, defense-in-depth against a misbehaving internal caller (e.g. a worker retry loop) — this service has no public ingress, so it is not the primary anti-abuse control.
- Neither limiter is shared/coordinated across multiple instances of the same service — a known limitation if this app is ever deployed with more than one replica per service.

## Request/file limits and validation

- Evidence upload: MIME allowlist + magic-byte content sniffing (not just trusting client-declared MIME type), size cap, minimum-resolution check, EXIF stripping, re-encoding to a normalized format — [`apps/web/src/lib/evidence/`](../../apps/web/src/lib/evidence/).
- `apps/ml-api`'s `/predict`/`/explain`/`/batch-predict` endpoints are internal-token gated ([`apps/ml-api/app/auth.py`](../../apps/ml-api/app/auth.py)) and never reachable from a browser (see `origin_guard.py` below).

## Signed URL expiry

- Evidence download URLs are short-lived, scoped to a single object, issued only after `apps/web` re-checks the requester's role/authorization for that specific report — see [`THREAT_MODEL.md`](THREAT_MODEL.md) threat #5 for the full residual-risk discussion (a signed URL is inherently bearer-token-like during its validity window; this is a known, accepted trade-off, not a gap).

## Origin enforcement on internal services

- `apps/ml-api` has no public ingress and is never called from a browser. [`apps/ml-api/app/origin_guard.py`](../../apps/ml-api/app/origin_guard.py)'s `StrictOriginMiddleware` rejects any request carrying a browser-style `Origin` header not in an explicit allowlist (empty by default — i.e. reject every browser-origin request) — the inverse of permissive CORS middleware.

## Row-Level Security / least privilege

- RLS is the authoritative authorization boundary for every table (`docs/adr/0002-supabase-platform.md`); server-side role checks in `apps/web` are defense-in-depth, never the sole gate.
- Every privileged write goes through a `SECURITY DEFINER` RPC with an explicit role check (`has_role(...)`), server-resolved actor (`current_profile_id()` — never trusting a client-supplied profile ID), and an atomic `append_audit_event()` call in the same transaction. See e.g. `record_analysis_result`, `place_legal_hold`, `record_consent`, `review_deletion_request`.
- `audit_events` is append-only: no `UPDATE`/`DELETE` policy exists for any role, including System Administrator (see [THREAT_MODEL.md](THREAT_MODEL.md) threat #12). Verified by pgTAP (`supabase/tests/030_rls_audit_events.sql`).
- pgTAP role-boundary tests (`supabase/tests/`) exercise actual Postgres role-switching + `auth.uid()` simulation for: `reports`, `audit_events`, `claim_analysis_jobs`, and — added this block — `report_evidence`, `gemini_advisory_requests`, `system_settings`, `incident_clusters`/`cluster_members`, `response_tasks`/`task_assignments` (`supabase/tests/050_rls_block28_remaining_tables.sql`).

## Secret scanning / dependency audit

- **Not implemented in CI.** This block's own decision (see [WORKING_CONTRACT.md](../product/WORKING_CONTRACT.md) BLOCK 28 entry): CI scope for this block is "document only, no CI changes" — adding a secret-scanning/dependency-audit CI job is real, valuable work but was judged out of this block's scope given the effort already spent on runtime hardening. This is a genuine, disclosed gap, tracked as unfinished Production-tier work per [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md).
- In the interim: `.env` files are never committed (enforced by `.gitignore`, per [AGENTS.md](../../AGENTS.md)); `SUPABASE_SERVICE_ROLE_KEY`/`ML_INTERNAL_TOKEN`/`GEMINI_API_KEY`/`SENTRY_DSN` (server-only) are validated as required/optional server-only env vars ([`packages/domain/src/env.ts`](../../packages/domain/src/env.ts)) and never referenced by any `NEXT_PUBLIC_*` variable.

## Sanitized logs

- Structured JSON logging with automatic redaction is implemented across all three services: [`apps/web/src/lib/observability/logger.ts`](../../apps/web/src/lib/observability/logger.ts), [`apps/worker/worker/logging_setup.py`](../../apps/worker/worker/logging_setup.py), [`apps/ml-api/app/logging_setup.py`](../../apps/ml-api/app/logging_setup.py). Every log line redacts any field whose key looks secret-shaped (password/token/secret/key/authorization/cookie/dsn) or is a known PII field (email/phone/address/sha256Hash/perceptualHash), and replaces any raw binary/bytes value with a byte-count placeholder — so evidence image bytes can never end up in a log line even if a future call site accidentally passes one. See [OBSERVABILITY.md](../architecture/OBSERVABILITY.md) for the full logging contract.

## Gemini prompt-injection protection

- Unchanged from BLOCK 22/[THREAT_MODEL.md](THREAT_MODEL.md) threat #8 — reporter-supplied text is always passed inside an explicitly labeled untrusted-data block, never concatenated into the instruction text; responses are constrained to a fixed structured-output schema; every call is logged (structured output/error only, never chain-of-thought) in `gemini_advisory_requests`, readable by Verifier and Auditor for after-the-fact review.

## Telemetry PII redaction

- Covered by the "Sanitized logs" section above — the same redaction rules apply uniformly to every structured log line, not a separate telemetry-only path.
- Sentry (when `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` is configured — conditionally initialized, no-op otherwise) is configured with `sendDefaultPii: false` in all three services ([`apps/web/src/lib/observability/sentry.client.ts`](../../apps/web/src/lib/observability/sentry.client.ts), `sentry.server.ts`, [`apps/ml-api/app/observability.py`](../../apps/ml-api/app/observability.py), [`apps/worker/worker/observability.py`](../../apps/worker/worker/observability.py)) — an unhandled exception's captured context never includes request bodies containing report descriptions, coordinates, or evidence paths by default.

## Consent and privacy

See [PRIVACY_MODEL.md](../product/PRIVACY_MODEL.md) for the full privacy model — this checklist only notes the security-relevant mechanics: consent acceptance is recorded via a `SECURITY DEFINER` RPC (`record_consent`) so every acceptance is atomically audited, and `consent_records` has no `UPDATE`/`DELETE` policy for any role (an acceptance is an immutable historical fact).

## Known gaps (explicitly out of this block's scope)

- No CI-enforced secret scanning or dependency audit (see above).
- Rate limiters are per-process, not coordinated across replicas.
- No automated penetration testing or third-party security audit (capstone-scope gap, per [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)).
- No key-rotation runbook or automated secret-rotation tooling.
- Auth cookie is not `httpOnly` (see "Session cookie attributes" above for the specific architectural reason).
