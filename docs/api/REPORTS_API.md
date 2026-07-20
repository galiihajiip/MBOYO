# Reports API

BFF/domain-service layer for the `report` entity's full lifecycle: creation, own/queue/operational listing, verification decisions, and archival. Built in BLOCK 16 on top of the schema/RLS from BLOCK 08, the offline queue from BLOCK 13, and the evidence pipeline from BLOCK 15.

See also: [STATE_MACHINES.md](../product/STATE_MACHINES.md) (the authoritative state machine every transition here implements), [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) (the permission table every route enforces), [THREAT_MODEL.md](../security/THREAT_MODEL.md).

## Response envelope — `ApiResult<T>`

Every route in this document returns exactly one of these two shapes, regardless of HTTP status:

```ts
// Success
{ ok: true, data: T, requestId: string }

// Failure
{ ok: false, error: { code: ApiErrorCode, message: string, fieldErrors?: Record<string, string[]> }, requestId: string } }
```

`requestId` is present on every response (success or failure) — either echoed from an inbound `x-request-id` header or minted fresh, so a specific request can be correlated across client logs, server logs, and a bug report without exposing internals in the message itself.

`fieldErrors` is present only on `validation_failed`, keyed by the Zod issue path (e.g. `"description"`, `"overrideSeverity"`), each value a list of messages for that field — enough for a form UI to highlight the right input.

Source: [`apps/web/src/lib/api/result.ts`](../../apps/web/src/lib/api/result.ts).

## Stable error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `unauthenticated` | 401 | No valid session. |
| `forbidden` | 403 | Authenticated, but the caller's role doesn't permit this action (per RBAC_MATRIX.md). |
| `validation_failed` | 400 | Request body/query failed Zod validation — see `fieldErrors`. |
| `not_found` | 404 | The resource doesn't exist, **or** exists but RLS makes it invisible to this caller — these two cases are deliberately indistinguishable in the response (see "RLS is the authorization boundary" below). |
| `conflict` | 409 | Reserved for future use (e.g. a uniqueness violation not already handled by idempotent upsert). |
| `invalid_transition` | 409 | A domain command was attempted from a report status that doesn't allow it (e.g. submitting a verification decision on a `draft_local` report). |
| `precondition_failed` | 412 | Reserved for future use. |
| `rate_limited` | 429 | Reserved for future use — no rate limiting is implemented yet. |
| `internal_error` | 500 | An unexpected server-side failure. The underlying exception/database error is never echoed in `message`. |

A code's meaning never changes once shipped, and a code already in use is never removed while any client (notably the offline sync-replay logic) may depend on it — only added to. Source: [`apps/web/src/lib/api/error-codes.ts`](../../apps/web/src/lib/api/error-codes.ts).

**Retryability**: `lib/offline/sync-replay.ts` (the offline queue's replay logic) treats only `unauthenticated`, `rate_limited`, and `internal_error` as retryable; every other code means retrying the exact same request cannot succeed. This is a client-side convention layered on top of these codes, not a property of the codes themselves.

## Authorization model

Every route calls `requireApiRole(...)` or `requireApiPermission(entity, action)` ([`apps/web/src/lib/api/authorize.ts`](../../apps/web/src/lib/api/authorize.ts)) before touching any domain logic — the API-route counterpart of `lib/auth/server.ts`'s page-context `requireRole`/`requirePermission`, differing only in that it throws `ApiError` (translated into an `ApiResult` failure) instead of issuing an HTTP redirect, which would be wrong for a JSON API caller.

**RLS is the authorization boundary for "which rows," not application code.** Every list/detail domain-service function runs its query through the request-scoped, RLS-bound Supabase client (`lib/supabase/server.ts`) — a Reporter's client can only ever see their own reports, a Verifier's can see all, a Coordinator's can see only `verified` ones, regardless of what filters a route requests. Application code adds narrowing on top (e.g. the Verifier queue route only *requests* `analysis_completed`/`needs_manual_review`, for UX reasons) but removing that narrowing would only change which subset of RLS-visible rows are shown — it could never expose a row RLS itself denies. This is why `not_found` covers both "doesn't exist" and "exists but not visible to you": distinguishing them would leak information about resources outside the caller's access.

## Domain commands, not an arbitrary status endpoint

**There is no endpoint that accepts a target `status` directly.** Every state change is a named domain command whose input describes *what happened* (a verification decision, an archive request), never *what state to end up in*. The resulting status is computed entirely inside a `SECURITY DEFINER` Postgres function — [`submit_verification_decision`](../../supabase/migrations/20260717032932_report_domain_commands.sql) and [`archive_report`](../../supabase/migrations/20260717032932_report_domain_commands.sql) — which also performs the actor check, the precondition check (current status must be a valid source state per [STATE_MACHINES.md](../product/STATE_MACHINES.md)), the side-effect row insert, and the audit event, all in one atomic transaction. Application code (the route handler and `lib/reports/service/transitions.ts`) only validates the request shape and translates the RPC's result/error — it does not decide whether a transition is valid.

## Audit events

Every mutation that changes a report's lifecycle state appends an `audit_events` row via [`append_audit_event`](../../supabase/migrations/20260716153713_rpc_functions.sql) (BLOCK 08) — the only sanctioned write path to that table:

| Action | Entity | When |
|---|---|---|
| `report.created` | `report` | First successful creation via `POST /api/reports` (not on a retried upsert of the same `client_report_id` — see `lib/reports/service/create.ts`). |
| `report.verified` | `report` | `submit_verification_decision` with `decision = confirm` or `override`. |
| `report.rejected` | `report` | `submit_verification_decision` with `decision = reject`. |
| `report.information_requested` | `report` | `submit_verification_decision` with `decision = request_info`. |
| `report.escalated` | `report` | `submit_verification_decision` with `decision = escalate`. |
| `report.archived` | `report` | `archive_report`. |

## Endpoints

### `POST /api/reports` — create report

**Permission:** `report:create` (Reporter only).
**Body:** `CreateReportInput` (`clientReportId: uuid`, `eventId: uuid`, `description?: string`, `createdAtClient?: ISO datetime`).
**Response:** `{ report: ReportSummaryDto }`.
**Idempotent** on `(reporter_profile_id, client_report_id)` — a retried submission (Background Sync replaying a queued item after a dropped connection) upserts the same row rather than duplicating it. This is the sync target for the offline queue (`lib/offline/sync-replay.ts`); its response envelope is exactly `ApiResult<{report}>`, so a change to this shape must stay in lockstep with that file.

### `GET /api/reports` — own report list

**Permission:** `report:read` (Reporter, Verifier, Coordinator, Auditor all technically hold this permission, but RLS scopes the actual visible rows — see below).
**Query:** `status?`, `eventId?`, `search?` (filters), `page?`, `pageSize?` (pagination, default 1/20, max pageSize 100).
**Response:** `PaginatedResult<ReportSummaryDto>` (`items`, `page`, `pageSize`, `totalCount`, `totalPages`).
**Visible rows:** RLS restricts this to the Reporter's own reports (`reports_reporter_select_own`) when called by a Reporter — this route applies no explicit ownership filter itself, trusting RLS entirely.

### `GET /api/reports/:reportId` — own report detail

**Permission:** `report:read`.
**Response:** `{ report: ReportSummaryDto }`, or `not_found` if the id doesn't exist or isn't visible to this caller.

### `GET /api/verifier/reports` — verifier queue

**Permission:** role `verifier`.
**Query:** same as the own-list route.
**Response:** `PaginatedResult<ReportSummaryDto>`, narrowed to `analysis_completed`/`needs_manual_review` by default (the statuses a Verifier actually needs to act on) — RLS separately allows a Verifier to read any status, but this route's queue view intentionally doesn't surface Reporter-side sync-mechanics statuses like `draft_local`/`syncing`.

### `GET /api/verifier/reports/:reportId` — verifier report detail

**Permission:** role `verifier`.
**Response:** `{ report: ReportSummaryDto }`. RLS (`reports_verifier_select_all`) lets a Verifier see a report at any status, unlike the Reporter's own-only detail route.

### `GET /api/coordinator/reports` — coordinator operational reports

**Permission:** role `response_coordinator`.
**Query:** `eventId?`, `page?`, `pageSize?` — no `status` filter is accepted, since Coordinator authority begins at verification and there is exactly one status this view ever shows.
**Response:** `PaginatedResult<ReportSummaryDto>`, restricted to `status = 'verified'` both by RLS (`reports_coordinator_select_verified`) and by this route's explicit request, per [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) ("Coordinator's authority begins at verification").

### `POST /api/reports/:reportId/decision` — submit a verification decision

**Permission:** `report:approve` (Verifier only).
**Body:** `SubmitVerificationDecisionInput` — `decision: "confirm" | "override" | "reject" | "request_info" | "escalate"`, `overrideSeverity?: SeverityClass` (required if and only if `decision = "override"`), `notes?: string`.
**Response:** `{ report: ReportSummaryDto }` with the updated status.
**Valid only from** `analysis_completed` or `needs_manual_review` — any other current status returns `invalid_transition`. This is the **only** endpoint that can move a report out of those two statuses; there is no separate "request additional information" endpoint — `request_info` is one of the five decision values, keeping the report in `needs_manual_review` (annotated via the `verification_reviews.notes` the decision carries), per [STATE_MACHINES.md](../product/STATE_MACHINES.md)'s Escalation/decision model.

Resulting status per decision:

| `decision` | Resulting `reports.status` |
|---|---|
| `confirm` | `verified` |
| `override` | `verified` (with `verification_reviews.override_severity` set) |
| `reject` | `rejected` |
| `request_info` | `needs_manual_review` (unchanged — annotated, not moved) |
| `escalate` | `needs_manual_review` (unchanged — annotated as escalated) |

### `POST /api/reports/:reportId/archive` — archive a report

**Permission:** `report:configure` (System Administrator only — modeled as retention management, not validation; see [RBAC_MATRIX.md](../product/RBAC_MATRIX.md)).
**Body:** `ArchiveReportInput` (`reason?: string`).
**Response:** `{ report: ReportSummaryDto }` with `status: "archived"`.
**Valid only from** `verified` or `rejected` — never from `analysis_completed`/`needs_manual_review`, which structurally prevents this endpoint from being used to bypass Verifier review. This is the manual half of [STATE_MACHINES.md](../product/STATE_MACHINES.md)'s `verified/rejected → archived` transition; the scheduled-retention-job half doesn't exist yet (no scheduler exists in this codebase) but would call the same `archive_report()` RPC this endpoint calls.

## Testing

- Unit tests for the shared kernel (`lib/api/*`), the domain-service functions (`lib/reports/service/*`) against a fake Supabase-client double, and the RBAC transcription (`lib/auth/permissions.test.ts`, extended for `report:configure`) live alongside their source files.
- No live-database integration test exists in this session (no live Supabase instance reachable, consistent with every prior block) — the RPC functions' actor/precondition logic is reviewed manually and exercised indirectly through the domain-service unit tests' mocked-error-code translation paths.
