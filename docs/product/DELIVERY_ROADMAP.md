# MBOYO Delivery Roadmap

This roadmap sequences work by dependency, not by calendar date — each block should be runnable and independently reviewable per [AGENTS.md](../../AGENTS.md). Blocks are grouped into phases that map to the tiers in [MVP_SCOPE.md](MVP_SCOPE.md).

## Phase 0 — Foundation (Blocks 00–04)

Goal: lock product definition, architecture, RBAC, and information architecture before any UI is designed or code is written.

- BLOCK 00 — Repository audit and engineering contract (AGENTS.md, WORKING_CONTRACT.md). **Done.**
- BLOCK 01 — Product charter, scope tiers, success metrics, roadmap, risk register (this set of documents). **In progress.**
- BLOCK 02 — Information architecture: navigation, screen inventory, and data model sketch per role (not yet started).
- BLOCK 03 — Database schema and RLS policy design for the five roles (not yet started).
- BLOCK 04 — API contract definition between `apps/web`, `apps/ml-api`, and `apps/worker` (not yet started).

Exit criterion for Phase 0: every document in this phase cross-references consistently, and there are no unresolved RBAC or architecture ambiguities that would block design work.

## Design Gate

After Phase 0, Google Stitch designs are generated and must be approved before implementation blocks begin. This gate exists so that UI/UX decisions are made deliberately rather than emerging ad hoc during implementation.

## Phase 1 — MVP Implementation

Goal: make the [MVP live flow](PRODUCT_CHARTER.md#the-mvp-live-flow) real, per [MVP_SCOPE.md](MVP_SCOPE.md) Tier 1.

Indicative sequencing (exact block numbers assigned when each block starts):

1. Monorepo scaffold: `apps/web`, `apps/ml-api`, `apps/worker`, shared `packages/*`, tooling (TypeScript strict, ESLint, Python type checking).
2. Supabase project setup: schema migrations, RLS policies matching the five-role RBAC, seed data for one demo event.
3. Reporter flow: auth, report creation form, photo/GPS capture, Dexie local queue, offline-capable submission.
4. Sync engine: Background Sync integration, idempotent upload to Supabase, `analysis_jobs` enqueue.
5. ML inference path: minimal `apps/ml-api` serving a first trained model (or an explicitly labeled pre-release/advisory-only model per the [release gate](SUCCESS_METRICS.md#release-gate)), `apps/worker` job consumption.
6. Verifier UI: evidence review, probabilities/quality/location-confidence display, decision actions.
7. Coordinator UI: verified-incident map view (MapLibre), priority setting, task creation/assignment.
8. Escalation surfacing and minimal analytics view.
9. Auditor UI: single-report lineage timeline.
10. End-to-end live-flow rehearsal against real (non-demo-mode) infrastructure; any gaps found here roll back into the relevant block rather than being patched over.

## Phase 2 — Enhanced Demo

Goal: [MVP_SCOPE.md](MVP_SCOPE.md) Tier 2 — resilience and presentability across realistic edge cases.

- Multi-event support.
- Duplicate detection surfaced to Verifier.
- Senior-review escalation path.
- Coordinator incident grouping.
- Data export (CSV/GeoJSON).
- Accessibility baseline pass.
- Recharts analytics dashboard.
- Push notifications (VAPID).

## Phase 3 — Production Hardening

Goal: [PRODUCTION_SCOPE.md](PRODUCTION_SCOPE.md) — security, reliability, observability, and data governance requirements needed to run this beyond a single demo.

- RBAC/RLS audit across all routes.
- Retention policy enforcement job.
- Model registry and versioned evaluation reports.
- Service health monitoring for System Administrator.
- Optional Gemini advisory integration.
- Full WCAG 2.1 AA conformance pass.

## Phase 4 — Future Directions

Not scheduled; tracked in [MVP_SCOPE.md](MVP_SCOPE.md) Tier 4 for reference only.

## Roadmap Discipline

- No phase begins before the prior phase's exit criteria are met, unless the user explicitly directs otherwise (per the "How to Use" instructions in the master build plan).
- If acceptance criteria for a block fail, the correction happens within that block before the next block starts — this roadmap does not get renumbered or skipped to "stay on schedule."
- Any change to phase sequencing or scope is recorded as a decision in [WORKING_CONTRACT.md](WORKING_CONTRACT.md)'s decision log.
