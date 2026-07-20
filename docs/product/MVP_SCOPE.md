# MBOYO MVP Scope

This document defines four tiers of scope: **MVP**, **Enhanced Demo**, **Production**, and **Future**. Each tier is additive — Enhanced Demo includes MVP, Production includes Enhanced Demo, Future includes Production.

A capability only counts as delivered at a tier if it is real (live infrastructure, no fabricated data) unless explicitly listed under that tier's "Permitted Demo Fallbacks."

## Tier 1 — MVP

Goal: prove the full [MVP live flow](PRODUCT_CHARTER.md#the-mvp-live-flow) works end-to-end, live, with real infrastructure, for a single demo event/region.

### In scope

- Reporter auth (Supabase Auth), single event context.
- Report creation: photo capture/select + GPS capture, saved to local Dexie queue.
- Full offline capability for report creation — no network dependency to create/save/queue.
- Queue persistence across page reload (IndexedDB survives refresh).
- Reconnect-triggered automatic sync via Background Sync, idempotent (safe to retry, no duplicate incidents from repeated sync attempts).
- Upload of report + evidence to Supabase Storage + Postgres on sync.
- Enqueue of `analysis_jobs` row on successful report sync.
- `apps/worker` picks up `analysis_jobs`, calls `apps/ml-api` for inference, writes back probabilities, quality flags, and duplicate/location-confidence signals.
- Verifier UI: view evidence, quality signals, model probabilities/explanation, location confidence; actions to confirm, override, reject, request info, or escalate.
- Response Coordinator UI: view verified/escalated incidents on a MapLibre map, set priority, create and assign a response task.
- Basic escalation surfacing (an escalated incident is visibly distinguished for the coordinator).
- Minimal analytics view reflecting current incident/task counts (updates after state changes — polling acceptable, real-time not required at this tier).
- Auditor UI: read-only timeline for a single report showing report → analysis → verification → dispatch lineage.
- One seeded demo event with a small, realistic set of report scenarios (varied image quality, varied GPS confidence) for live walkthroughs.

### Permitted Demo Fallbacks at MVP Tier

- If live network conditions cannot be relied upon during a presentation, `DEMO_MODE` may simulate the "go offline / reconnect" transition via a UI toggle rather than actually disabling the device radio — the underlying queue/sync code path executed must be identical to the real offline path (no separate mocked sync function). This must be visibly labeled per [AGENTS.md](../../AGENTS.md) demo fallback rules.
- ML inference itself is never mocked at MVP tier — `apps/ml-api` must return genuine model output. If model quality is too early-stage to be useful in a live demo, this is a training/evaluation gap to flag in [RISK_REGISTER.md](RISK_REGISTER.md), not a reason to fabricate output.

### Explicitly out of scope for MVP

- Multi-event / multi-tenant support.
- Advanced analytics, trend charts, cross-event comparison.
- Gemini advisory integration.
- Push notifications (VAPID) — informational requests may be poll-based.
- Fine-grained retention policy enforcement.
- Bias/fairness evaluation reporting (tracked, not blocking, at this tier — see [SUCCESS_METRICS.md](SUCCESS_METRICS.md)).

## Tier 2 — Enhanced Demo

Goal: make the MVP flow resilient and presentable across realistic edge cases and multiple simultaneous demo scenarios.

### Adds

- Multiple concurrent demo events/regions.
- Duplicate-report detection surfaced explicitly to Verifier (not just a hidden signal).
- Escalation workflow with senior-review distinction (Verifier → senior Verifier).
- Coordinator grouping of related incidents (e.g., same building, same road segment).
- Export of operational data (CSV/GeoJSON) for a selected event.
- Basic accessibility pass (keyboard navigation, color contrast for severity palette, screen-reader labeling on core flows).
- Recharts-based analytics dashboard (counts by severity, by status, by region).
- Push notifications for Verifier queue and Coordinator new-incident alerts (VAPID).

## Tier 3 — Production

Goal: the architecture and controls needed to run this for a real disaster-response organization beyond a single hackathon demo, within the non-goals stated in [WORKING_CONTRACT.md](WORKING_CONTRACT.md).

### Adds

- Full RBAC enforcement audited across every route and RLS policy (not just MVP's core flow).
- Retention policy enforcement (raw evidence lifecycle, per [RISK_REGISTER.md](RISK_REGISTER.md) sensitive-imagery handling).
- Model registry and versioned evaluation reports checked into `ml/reports/`, with the release gate from [SUCCESS_METRICS.md](SUCCESS_METRICS.md) enforced before any model promotion.
- Service health monitoring surfaced to System Administrator.
- Optional Gemini advisory integration, explicitly labeled as advisory-only and never authoritative, per [AGENTS.md](../../AGENTS.md).
- Formal incident response runbook for platform outages (Supabase, ml-api, map tile provider).
- Full accessibility conformance target (WCAG 2.1 AA) across all five role UIs.

## Tier 4 — Future

Directional only — not committed, not scheduled.

- Multi-region / multi-tenant deployment with data residency controls.
- On-device (edge) inference to reduce dependency on `apps/ml-api` reachability during sync.
- Automated bias monitoring dashboards with alerting.
- Integration with external emergency-response dispatch systems (e.g., government CAP feeds).
- Field hardware integrations (e.g., satellite messengers) for zero-connectivity regions.

## Relationship to Production Scope Document

[PRODUCTION_SCOPE.md](PRODUCTION_SCOPE.md) expands Tier 3 into concrete engineering requirements (security, reliability, observability) separate from feature scope described here.
