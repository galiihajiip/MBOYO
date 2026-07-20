# MBOYO Database Schema, RLS, RPC Functions, and Seed Data

This document describes the Postgres schema implemented in `supabase/migrations/`, the RLS policies enforcing [RBAC_MATRIX.md](../product/RBAC_MATRIX.md), the RPC functions supporting geospatial queries and safe job claiming, the Realtime publication, and the demo seed data in `supabase/seed.sql`. It complements [LOCAL_PLATFORM.md](LOCAL_PLATFORM.md) (platform-level config) and [DOMAIN_MODEL.md](../product/DOMAIN_MODEL.md) (the entity specification this schema implements).

## Migration Files

| File | Contents |
|---|---|
| `20260716145222_enable_postgis.sql` | PostGIS extension only (BLOCK 07). |
| `20260716153709_core_schema.sql` | Enums, all 22 domain tables, indexes, `updated_at` triggers. Grants no access — RLS is added separately. |
| `20260716153710_permission_helpers.sql` | `current_profile_id()`, `has_role()`, `has_any_role()`, `owns_report()` — SQL functions used by RLS policies. |
| `20260716153711_rls_policies.sql` | RLS policies for every table, implementing [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) exactly. |
| `20260716153713_rpc_functions.sql` | `reports_in_bbox`, `reports_within_radius`, `cluster_destroyed_reports`, `claim_analysis_jobs`, `append_audit_event`. |
| `20260716153714_realtime_publication.sql` | Adds `reports`, `response_tasks`, `notifications`, `analysis_jobs` to `supabase_realtime`. |

## Schema Design Decisions

### UUID keys and timestamps

Every table uses `uuid primary key default gen_random_uuid()` (via `pgcrypto`, bundled with the Supabase Postgres image). Tables that are ever updated post-creation (`profiles`, `reports`) carry `updated_at timestamptz` maintained by a `set_updated_at()` trigger; all tables carry a creation timestamp (`created_at`, or a more specific name like `decided_at`/`occurred_at`/`granted_at` where the domain has a more precise name for "when this happened").

### Archive semantics

`reports.archived_at` is a nullable timestamp rather than a fourth state bolted onto `report_status` — `archived` is already a terminal status in [STATE_MACHINES.md](../product/STATE_MACHINES.md), and `archived_at` additionally records *when* archival happened (needed for the retention-policy reporting in [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)) without requiring a second lookup. `disaster_events.status = 'closed'` plus `ends_at` is the equivalent archive signal at the event level.

### Geography columns and GIST indexes

- `geolocation_observations.location geography(Point, 4326)` — WGS84 lon/lat, matching raw GPS output directly.
- `disaster_events.geofence geography(Polygon, 4326)` — for the geofence cross-check in [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #3.
- `geolocation_observations_location_gist_idx` is a GIST index on `location` — the standard PostGIS index type, required for `reports_in_bbox`/`reports_within_radius` to execute as index scans (`&&` bounding-box overlap, `ST_DWithin` radius) rather than sequential scans across every observation.

### State enums

`report_status`, `task_status`, `analysis_job_status`, `verification_decision`, `severity_class`, `priority_level`, `disaster_event_status`, `export_job_status`, and `app_role` are all native Postgres `enum` types — matching [STATE_MACHINES.md](../product/STATE_MACHINES.md) and [DOMAIN_MODEL.md](../product/DOMAIN_MODEL.md) value sets exactly, so an invalid status value is a schema-level type error, not an application-level bug waiting to happen.

### Unique `client_report_id`

`reports_client_report_id_unique_idx` is a unique index on `(reporter_profile_id, client_report_id)` — scoped per-reporter rather than globally unique, since `client_report_id` is a client-generated UUID (per [ADR 0005](../adr/0005-offline-indexeddb-workbox.md)) and two different reporters' locally-generated UUIDs should never be able to collide into a false duplicate, while the same reporter's retried sync of the same local report must upsert onto the same row (the idempotency mechanism in [SEQUENCE_FLOWS.md](../architecture/SEQUENCE_FLOWS.md) Diagram 3).

### SHA-256 and perceptual-hash fields

`report_evidence.sha256_hash` (`char_length = 64`, hex-encoded SHA-256) supports exact-duplicate-file detection and integrity verification. `report_evidence.perceptual_hash` (nullable, populated once computed) supports near-duplicate *image* detection — a different, complementary signal from the exact-file hash, feeding the Verifier's duplicate-candidate signal (`model_predictions.duplicate_candidate_report_id`).

### Probability/confidence check constraints

- `model_predictions.severity_probabilities` (jsonb) has a check constraint requiring all five severity keys to be present, each value in `[0, 1]`, and the five values to sum to `~1` (±0.01 tolerance for floating-point serialization) — a malformed or fabricated probability vector is rejected at the database layer, not merely trusted from `apps/worker`, per the ML honesty rules in [AGENTS.md](../../AGENTS.md).
- `model_predictions.quality_score`, `geolocation_observations.confidence_signal` — bounded to `[0, 1]` by check constraint.
- `model_evaluations.macro_f1`, `destroyed_recall`, `calibration_error` — bounded to `[0, 1]`, `NOT NULL` (an evaluation row only exists once a real evaluation has produced these numbers — no nullable "TBD" placeholder is permitted).

### Queue and map indexes

- `analysis_jobs_queued_idx` — a **partial** index (`WHERE status = 'queued'`) on `created_at`, matched exactly by `claim_analysis_jobs`'s `WHERE status = 'queued' ORDER BY created_at LIMIT n FOR UPDATE SKIP LOCKED` — this is "the queue index."
- `geolocation_observations_location_gist_idx` — "the map index," per the geospatial section above.

### Immutable audit events

`audit_events` has RLS enabled with `FORCE` and policies granting only `SELECT` to `system_administrator`/`auditor` — no `UPDATE`/`DELETE` policy exists for any role, and `REVOKE UPDATE, DELETE ON public.audit_events FROM anon, authenticated` removes the underlying grant as defense in depth (so even a future policy-authoring mistake couldn't accidentally re-open mutation, since the grant itself is gone). The only write path is `append_audit_event()`, a `SECURITY DEFINER` function — there is no direct `INSERT` policy on the table at all, so application code cannot bypass that function's shape validation and automatic actor-attribution.

### Realtime publication

`reports`, `response_tasks`, `notifications`, and `analysis_jobs` are added to the `supabase_realtime` publication — the specific tables with a genuine live-update UX requirement documented in [SCREEN_INVENTORY.md](../product/SCREEN_INVENTORY.md) (Verifier queue, Coordinator map/task list, every role's notifications, System Administrator's health view). Not every table is published — Realtime is a UX enhancement per [ADR 0002](../adr/0002-supabase-platform.md), not the system of record.

## RLS Policies

Every table has RLS **enabled and forced** (`ALTER TABLE ... ENABLE/FORCE ROW LEVEL SECURITY`), so even the migration-runner role is subject to policy — service-role connections bypass RLS by Supabase's own design (the intended "server-only bypass" documented in [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)), never a leak introduced by this schema.

Permission-helper functions (`current_profile_id()`, `has_role()`, `has_any_role()`, `owns_report()`) are `STABLE` and `SECURITY INVOKER` — they run under the *calling* role's own RLS-filtered view of `profiles`/`role_assignments`, so a helper can never silently grant broader access than the caller already has.

Every policy in `20260716153711_rls_policies.sql` is annotated with which row from [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) it implements. Two acceptance-relevant call-outs:

- **`reports` table:** System Administrator has *no* policy granting any access at all — confirmed by [RLS test](../../supabase/tests/020_rls_reports.sql) `020_rls_reports.sql`, which asserts an authenticated System Administrator session sees exactly zero rows from `reports`.
- **`audit_events` table:** confirmed by [RLS test](../../supabase/tests/030_rls_audit_events.sql) `030_rls_audit_events.sql`, which asserts both `UPDATE` and `DELETE` attempts raise an error for every role, including System Administrator.

## RPC Functions

| Function | Security mode | Purpose |
|---|---|---|
| `reports_in_bbox(min_lon, min_lat, max_lon, max_lat)` | `SECURITY INVOKER` | Reports with a `geolocation_observations` row inside a bounding box — powers map viewport queries (Peta Bukti, Peta Krisis). RLS-scoped to the caller automatically, since it runs under the caller's own permissions. |
| `reports_within_radius(center_lon, center_lat, radius_meters)` | `SECURITY INVOKER` | Reports within N meters of a point, nearest-first — powers geofence cross-checks and proximity queries. |
| `cluster_destroyed_reports(disaster_event_id, proximity_meters)` | `SECURITY INVOKER` | Suggests groupings of unclustered, verified, high-confidence-`destroyed` reports within a proximity threshold — a read-only suggestion for the Coordinator's clustering workflow; does not create `incident_clusters` rows itself, since clustering remains a human Coordinator decision per [STATE_MACHINES.md](../product/STATE_MACHINES.md). |
| `claim_analysis_jobs(worker_id, batch_size)` | `SECURITY DEFINER` + internal role guard | Atomically claims queued `analysis_jobs` via `FOR UPDATE SKIP LOCKED`, per [ADR 0003](../adr/0003-database-job-queue.md). **Must** be `SECURITY DEFINER` since no human role holds table-level `UPDATE` on `analysis_jobs` — but a bare `SECURITY DEFINER` grant to `authenticated` would let any role claim jobs, so the function raises an exception unless the caller is `system_administrator` (health tooling) or is bypassing via service-role. |
| `append_audit_event(entity_type, entity_id, action, detail)` | `SECURITY DEFINER` | The sole write path to `audit_events` — attributes the event to the caller's own `current_profile_id()` automatically. Granted to `authenticated` broadly since any user creating an attributed record of their own action is benign; the table's own lack of an `INSERT` policy is what actually prevents a caller from inserting an event outside this function's shape. |

## Seed Data

`supabase/seed.sql` seeds:

- One `organizations` row ("PIDI Digdaya Demo").
- One active `disaster_events` row with a real WGS84 geofence polygon over a South Jakarta area.
- Five demo `auth.users` (one per role) inserted directly (local-dev-only pattern — never done against a hosted project), each with a corresponding `profiles` row and an active `role_assignments` row: Reporter, Verifier, Response Coordinator, System Administrator, Auditor. All demo accounts share the password `mboyo-demo-password`.
- Two `model_registry_entries`: one promoted/active version with a passing `model_evaluations` row, and one unpromoted release candidate with a `destroyed_recall` deliberately below a plausible release-gate threshold — illustrating the advisory-only fallback path from [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md).
- Five `reports` spanning `verified`, `needs_manual_review`, `queued_offline`, `rejected`, and `draft_local` states, with associated `report_evidence`, `geolocation_observations`, `analysis_jobs`, `model_predictions`, `model_explanations`, and `verification_reviews` where the state machine implies they should exist.
- One `response_tasks` row (assigned) with a `task_assignments` row, for the verified report.
- Two `notifications` (one unread, one read).
- Five `audit_events`, written via `append_audit_event()` (the sanctioned path, exercised even in seed data) — covering the full report → analysis → verification → dispatch lineage for the verified report, so the Auditor's Audit Trail screen has a real, coherent story to display.
- Two `system_settings` rows.

## Tests

`supabase/tests/` contains pgTAP tests, run via `supabase test db` (requires `supabase db reset` to have applied migrations + seed first):

| File | Covers |
|---|---|
| `000_setup.sql` | Enables the `pgtap` extension for the test run (test-only dependency, not part of application migrations). |
| `010_geospatial.sql` | PostGIS presence and version; `geolocation_observations.location` is a `geography` column with a GIST index; `reports_in_bbox`/`reports_within_radius` return correct results for both a matching and a clearly-non-matching query. |
| `020_rls_reports.sql` | Reporter sees only their own reports; Verifier sees all; Response Coordinator sees only `verified`; **System Administrator sees zero** (the explicit "cannot validate" acceptance criterion); Auditor sees all and cannot `UPDATE`. |
| `030_rls_audit_events.sql` | Admin and Auditor can both read `audit_events`; neither can `UPDATE` or `DELETE` a row; a direct `INSERT` (bypassing `append_audit_event()`) fails for Auditor; `append_audit_event()` itself succeeds. |
| `040_claim_analysis_jobs.sql` | `claim_analysis_jobs` claims exactly the requested batch size, marks claimed rows `processing`, and a second concurrent call never re-claims an already-claimed row; a Reporter cannot `INSERT` a report attributed to another profile's `reporter_profile_id`. |

## Known Local Environment Caveat

As with [LOCAL_PLATFORM.md](LOCAL_PLATFORM.md)'s equivalent section, live verification of this block (`pnpm db:reset` applying all migrations + seed cleanly, then `pnpm exec supabase test db` passing) depends on a healthy local Docker daemon. All SQL in this block was written and manually reviewed for correctness (including one bug found and fixed during review — see the Decision Log entry in [WORKING_CONTRACT.md](../product/WORKING_CONTRACT.md) — `claim_analysis_jobs` initially granted `EXECUTE` to `authenticated` without an internal role guard, which would have let any role claim jobs; fixed by adding an explicit `has_role('system_administrator')` check inside the function). Live `db:reset`/`test db` verification is the outstanding step once Docker is responsive again.
